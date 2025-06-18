import type { OpenAPI, OpenAPIV3 } from "openapi-types";
import { Generator } from "./base-generator";
import { generateTypes } from "oatyp/build/src/types";
import { Project, Directory } from "ts-morph";
import invariant from "invariant";
import { compile } from "json-schema-to-typescript";
import path from "path";
import { spawn } from "bun";

export class TypescriptGenerator extends Generator {
  private project: Project;
  private rootDir: Directory;

  constructor(apiSpec: OpenAPIV3.Document) {
    super(apiSpec);
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json',
    });
    this.rootDir = this.project.createDirectory("./sdk/typescript");
  }
  
  private async generateTypes(filename: string = "definitions.ts") {
    const file = this.rootDir.createSourceFile(filename, undefined, { overwrite: true });
    await generateTypes(file, this.apiSpec, { addReadonlyWriteonlyModifiers: false });
  }

  private async generateParametersType(name: string, parameters: OpenAPIV3.ParameterObject[]): Promise<string> {
    const properties: Record<string, OpenAPIV3.SchemaObject> = {};
    const processedTypes = Object.keys(this.apiSpec.components!.schemas ?? {});
    let extraTypes: string = "";
    for(const property of parameters) {
      const schema = property.schema as OpenAPIV3.SchemaObject;
      if("$ref" in schema) {
        extraTypes += " & definitions." + (schema.$ref as string).split("/").pop()!;
      } else {
        properties[property.name] = schema;
      }
    }

    if(Object.keys(properties).length <= 0) {
      return extraTypes.replace(" & ", "");
    }

    const type = await compile({
      properties,
      required: parameters.map(p => p.required ? p.name : undefined).filter(p => p !== undefined)
    }, "ParameterTypes", {
      additionalProperties: false,
      format: false,
    });

    let endType = type.split("export interface ParameterTypes ")[1];
    invariant(endType, "End type not defined");
    endType = endType.replaceAll("\n", "; ").replace(";", "");
    return endType.substring(0, endType.length - 2);
  }

  private async build() {
    console.log("Building SDK");
    const buildProc = spawn({
      cmd: ['npx', '-y', 'tsc', '--build'],
      cwd: './sdk/typescript'
    })
    let code = await buildProc.exited;
    if (code !== 0) {
      throw new Error("Failed to build");
    }

    console.log("Packing SDK");
    const packProc = spawn({
      cmd: ['yarn', 'pack', '-f', 'wll-rewards-sdk.tgz'],
      cwd: './sdk/typescript'
    });

    code = await packProc.exited;
    if (code !== 0) {
      throw new Error("Failed to pack");
    }

    console.log("Packed to ./sdk/typescript/wll-rewards-sdk.tgz")
  }

  public async generateSdk(filename?: string) {
    await this.generateTypes(filename);

    const groupedMethods = Object.groupBy(Object.entries(this.apiSpec.paths).map(([item, value]) => ({ path: item, endpoints: value ?? {} })), ({path, endpoints: methods }) => {
      invariant(path, "Path not found");
      const randomHttpMethod = methods.get ?? methods.post ?? methods.patch ?? methods.put ?? methods.delete;
      let controller = randomHttpMethod?.operationId?.split(".")?.[0]?.replace("Controller", "");
      invariant(controller, "Controller must be defined");
      return controller;
    });

    const rewardSdk = this.project.createWriter();
    rewardSdk.writeLine("import { AuthProvider } from './auth-provider';");

    rewardSdk.blankLine();
    rewardSdk.writeLine("type BaseUrl = 'https://api.staging.rewards.wlloyalty.net/v1' | 'https://api.rewards.wlloyalty.net/v1' | 'https://api.staging.rewards.us.wlloyalty.net/v1' | 'https://api.rewards.us.wlloyalty.net/v1' | (string & {});")
    rewardSdk.writeLine("export type RewardSdkConfig = ").inlineBlock(() => {
      rewardSdk.writeLine('apiKey: string,')
      rewardSdk.writeLine('authProvider: AuthProvider,')
      rewardSdk.writeLine('baseUrl: BaseUrl')
    })
    rewardSdk.blankLine();

    rewardSdk.writeLine("export class WLLRewardsSdk {");
    rewardSdk.setIndentationLevel(rewardSdk.getIndentationLevel() + 1);
    rewardSdk.writeLine("private config: RewardSdkConfig;");
    rewardSdk.blankLine();


    for(const [controller, methods] of Object.entries(groupedMethods)) {
      const file = this.rootDir.createSourceFile(`controllers/${controller}.ts`, undefined, { overwrite: true });
      const codeWriter = this.project.createWriter();
      codeWriter.writeLine(`import * as definitions from "../definitions"`);
      codeWriter.writeLine("import { AuthProvider } from '../auth-provider'");
      codeWriter.writeLine("import { HttpBase } from '../http-base'")
      codeWriter.writeLine(`export class ${controller} extends HttpBase {`)
      codeWriter.setIndentationLevel(codeWriter.getIndentationLevel() + 1);

      for(const method of methods!) {
        const endpoints: [string, OpenAPIV3.OperationObject][] = Object.entries(method.endpoints).filter(([key]) => ["post", "get", "put", "patch", "delete", "options", "head"].includes(key)) as any;
        for(const [httpMethod, endpoint] of endpoints) {
          const methodName = endpoint.operationId?.split(".")[1];
          invariant(methodName, "Method name must be defined");
          let methodParameterString = '';
          let isBody = false;
          if(endpoint.requestBody && "content" in endpoint.requestBody) {
            const schema = endpoint.requestBody.content["application/json"]?.schema
            if(schema && Object.keys(schema).length > 0) {
              if("$ref" in schema) {
                const end = schema.$ref.split("/").pop();
                methodParameterString += `body: definitions.${end}`
              } else {
                methodParameterString += "body: any"
              }
              isBody = true;
            }
          }
          if(endpoint.parameters) {
            const parameters: Record<string, OpenAPIV3.ParameterObject[]> = Object.groupBy(endpoint.parameters.filter(i => "name" in i ? i.name !== "X-Api-Key" && i.name !== 'Authorization' : true), (item) => "in" in item ? item.in : "ref") as any;
            if(parameters.path && parameters.path.length > 0) {
              const parameterType = await this.generateParametersType("headers", parameters.path);
              methodParameterString += !methodParameterString ? "parameters: " + parameterType : ", parameters: " + parameterType;
            }
            if(parameters.header && parameters.header.length > 0) {
              const headersType = await this.generateParametersType("headers", parameters.header);
              methodParameterString += !methodParameterString ? "headers: " + headersType : ", headers: " + headersType;
            }
            if(parameters.query && parameters.query.length > 0) {
              const queryType = await this.generateParametersType("headers", parameters.query);
              methodParameterString += !methodParameterString ? "query: " +  queryType: ", query: " + queryType;
            }
          }

          const successResponse = endpoint.responses?.["200"];
          let responseType = 'any';
          if(successResponse && "content" in successResponse) {
            const schema = successResponse.content?.["application/json"]?.schema
            if(schema && Object.keys(schema).length > 0) {
              if("$ref" in schema) {
                const end = schema.$ref.split("/").pop();
                responseType = `definitions.${end}`
              }
            }
          }

          codeWriter.writeLine(`public async ${methodName}(${methodParameterString}): Promise<${responseType}>`).inlineBlock(() => {
            codeWriter.writeLine(`return this.invoke<${responseType}>('${method.path}', {`).indent(() => {
              codeWriter.writeLine(`method: '${httpMethod.toUpperCase()}',`);
              if(endpoint.parameters) {
                const parameters: Record<string, OpenAPIV3.ParameterObject[]> = Object.groupBy(endpoint.parameters.filter(i => "name" in i ? i.name !== "X-Api-Key" && i.name !== 'Authorization' : true), (item) => "in" in item ? item.in : "ref") as any;
                if(parameters.path && parameters.path.length > 0) {
                  codeWriter.writeLine(`parameters,`);
                }
                if(parameters.header && parameters.header.length > 0) {
                  codeWriter.writeLine(`headers,`);
                }
                if(parameters.query && parameters.query.length > 0) {
                  codeWriter.writeLine(`query,`);
                }
                if(isBody) {
                  codeWriter.writeLine(`body,`);
                }
              }
            }).writeLine("});")
          });

          codeWriter.blankLine();
        }
      }

      codeWriter.writeLine("constructor(authProvider: AuthProvider, baseUrl: string, apiKey: string)").inlineBlock(() => {
        codeWriter.writeLine("super(authProvider, baseUrl, apiKey)");
      })

      codeWriter.setIndentationLevel(codeWriter.getIndentationLevel() - 1);
      codeWriter.writeLine("}")
      file.insertText(0, codeWriter.toString());
      rewardSdk.writeLine(`public ${controller.charAt(0).toLowerCase() + controller.substring(1)}: ${controller};`)
    };


    const importStatements = this.project.createWriter();

    rewardSdk.writeLine("constructor(config: RewardSdkConfig)").inlineBlock(() => {
      rewardSdk.writeLine("this.config = config;");
      for(const [controller] of Object.entries(groupedMethods)) {
        importStatements.writeLine(`import { ${controller} } from './controllers/${controller}'`);
        rewardSdk.writeLine(`this.${controller.charAt(0).toLowerCase() + controller.substring(1)} = new ${controller}(config.authProvider, config.baseUrl, config.apiKey);`)
      }
    })

    rewardSdk.setIndentationLevel(rewardSdk.getIndentationLevel() - 1);
    rewardSdk.writeLine("}");
    rewardSdk.blankLine();

    this.rootDir.createSourceFile("auth-provider.ts", await this.getTemplate("auth-provider.ts"), { overwrite: true })
    this.rootDir.createSourceFile("admin-auth-provider.ts", await this.getTemplate("admin-auth-provider.ts"), { overwrite: true })
    importStatements.writeLine(`import { AdminAuthProvider } from './admin-auth-provider'`)
    this.rootDir.createSourceFile("static-auth-provider.ts", await this.getTemplate("static-auth-provider.ts"), { overwrite: true })
    importStatements.writeLine(`import { StaticAuthProvider } from './static-auth-provider'`)

    this.rootDir.createSourceFile("http-base.ts", await this.getTemplate("http-base.ts"), { overwrite: true })

    this.rootDir.createSourceFile("package.json", await this.getTemplate("package.json"), { overwrite: true })
    this.rootDir.createSourceFile("tsconfig.json", await this.getTemplate("tsconfig.json"), { overwrite: true })


    importStatements.blankLine();
    rewardSdk.writeLine("export { AdminAuthProvider, StaticAuthProvider, AuthProvider }")
    this.rootDir.createSourceFile("index.ts", importStatements.toString() + rewardSdk.toString(), { overwrite: true });

    await this.project.save();
    await this.build();
  }
  

  private async getTemplate(name: string) {
    return Bun.file(path.join(__dirname, '..', 'templates', 'typescript', name)).text()
  }
}