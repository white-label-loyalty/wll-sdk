import type { OpenAPI, OpenAPIV3 } from 'openapi-types';
import { Generator } from './base-generator';
import { generateTypes } from 'oatyp/build/src/types';
import { Project, Directory, Scope } from 'ts-morph';
import { Project as OldProject } from 'oatyp/node_modules/ts-morph';
import invariant from 'invariant';
import { compile } from 'json-schema-to-typescript';
import path from 'path';
import { spawn } from 'bun';

export class TypescriptGenerator extends Generator {
  private project: Project;
  private rootDir: Directory;

  constructor(apiSpec: OpenAPIV3.Document) {
    super(apiSpec);
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json',
    });
    this.rootDir = this.project.createDirectory('./sdk/typescript');
  }

  private async generateTypes(filename: string = 'definitions.ts') {
    const oldFile = new OldProject().createSourceFile('fake');

    await generateTypes(oldFile, this.apiSpec, {
      addReadonlyWriteonlyModifiers: false,
    });

    const file = this.rootDir.createSourceFile(
      filename,
      oldFile.getFullText(),
      {
        overwrite: true,
      },
    );
  }

  private async generateParametersType(
    name: string,
    parameters: OpenAPIV3.ParameterObject[],
  ): Promise<string> {
    const properties: Record<string, OpenAPIV3.SchemaObject> = {};
    const processedTypes = Object.keys(this.apiSpec.components!.schemas ?? {});
    let extraTypes: string = '';
    for (const property of parameters) {
      const schema = property.schema as OpenAPIV3.SchemaObject;
      if ('$ref' in schema) {
        extraTypes +=
          ' & definitions.' + (schema.$ref as string).split('/').pop()!;
      } else {
        properties[property.name] = schema;
      }
    }

    if (Object.keys(properties).length <= 0) {
      return extraTypes.replace(' & ', '');
    }

    const type = await compile(
      {
        properties,
        required: parameters
          .map((p) => (p.required ? p.name : undefined))
          .filter((p) => p !== undefined),
      },
      'ParameterTypes',
      {
        additionalProperties: false,
        format: false,
      },
    );

    let endType = type.split('export interface ParameterTypes ')[1];
    invariant(endType, 'End type not defined');
    endType = endType.replaceAll('\n', '; ').replace(';', '');
    return endType.substring(0, endType.length - 2);
  }

  private async build() {
    await spawn({
      cmd: ['rm', '-rf', 'dist'],
      cwd: './sdk/typescript',
    }).exited;

    console.log('Building SDK');
    const buildProc = spawn({
      cmd: ['npx', '-y', 'tsc', '--build'],
      cwd: './sdk/typescript',
    });
    let code = await buildProc.exited;
    if (code !== 0) {
      throw new Error('Failed to build');
    }

    console.log('Packing SDK');
    const packProc = spawn({
      cmd: ['yarn', 'pack', '-f', 'wll-rewards-sdk.tgz'],
      cwd: './sdk/typescript',
    });

    code = await packProc.exited;
    if (code !== 0) {
      throw new Error('Failed to pack');
    }

    console.log('Packed to ./sdk/typescript/wll-rewards-sdk.tgz');
  }

  public async generateSdk(filename?: string) {
    await this.generateTypes(filename);

    const groupedMethods = Object.groupBy(
      Object.entries(this.apiSpec.paths).map(([item, value]) => ({
        path: item,
        endpoints: value ?? {},
      })),
      ({ path, endpoints: methods }) => {
        invariant(path, 'Path not found');
        const randomHttpMethod =
          methods.get ??
          methods.post ??
          methods.patch ??
          methods.put ??
          methods.delete;
        let controller = randomHttpMethod?.operationId
          ?.split('.')?.[0]
          ?.replace('Controller', '');
        invariant(controller, 'Controller must be defined');
        return controller;
      },
    );

    const rewardSdk = this.rootDir.createSourceFile('index.ts', undefined, {
      overwrite: true,
    });

    rewardSdk.addImportDeclarations([
      {
        moduleSpecifier: './auth-provider',
        namedImports: ['AuthProvider'],
      },
      {
        moduleSpecifier: './admin-auth-provider',
        namedImports: ['AdminAuthProvider'],
      },
      {
        moduleSpecifier: './static-auth-provider',
        namedImports: ['StaticAuthProvider'],
      },
    ]);

    rewardSdk.addExportDeclaration({
      namedExports: ['AdminAuthProvider', 'StaticAuthProvider', 'AuthProvider'],
    });

    rewardSdk.addTypeAlias({
      name: 'BaseUrl',
      type: `'https://api.staging.rewards.wlloyalty.net/v1' | 'https://api.rewards.wlloyalty.net/v1' | 'https://api.staging.rewards.us.wlloyalty.net/v1' | 'https://api.rewards.us.wlloyalty.net/v1' | (string & {});`,
    });

    rewardSdk.addTypeAlias({
      name: 'RewardSdkConfig',
      type: (writer) => {
        writer.inlineBlock(() => {
          writer.writeLine('apiKey: string,');
          writer.writeLine('authProvider: AuthProvider,');
          writer.writeLine('baseUrl: BaseUrl');
        });
      },
      isExported: true,
    });

    const sdkClass = rewardSdk.addClass({
      name: 'WLLRewardsSdk',
      properties: [
        {
          name: 'config',
          type: 'RewardSdkConfig',
          scope: Scope.Private,
        },
      ],
      isExported: true,
    });

    const ctor = sdkClass.addConstructor({
      parameters: [
        {
          name: 'config',
          type: 'RewardSdkConfig',
        },
      ],
      statements: 'this.config = config;',
    });

    for (const [controller, methods] of Object.entries(groupedMethods)) {
      sdkClass.addProperty({
        name: controller.charAt(0).toLowerCase() + controller.substring(1),
        type: controller,
        scope: Scope.Public,
      });
      rewardSdk.addImportDeclaration({
        moduleSpecifier: `./controllers/${controller}`,
        namedImports: [controller],
      });
      ctor.addStatements(
        `this.${controller.charAt(0).toLowerCase() + controller.substring(1)} = new ${controller}(config.authProvider, config.baseUrl, config.apiKey);`,
      );

      const file = this.rootDir.createSourceFile(
        `controllers/${controller}.ts`,
        undefined,
        { overwrite: true },
      );
      file.addImportDeclaration({
        moduleSpecifier: '../definitions',
        defaultImport: '* as definitions',
      });

      file.addImportDeclarations([
        {
          moduleSpecifier: '../auth-provider',
          namedImports: ['AuthProvider'],
        },
        {
          moduleSpecifier: '../http-base',
          namedImports: ['HttpBase', 'RequestParams'],
        },
      ]);

      const ctrlClass = file.addClass({
        name: controller,
        extends: 'HttpBase',
        ctors: [
          {
            parameters: [
              {
                name: 'authProvider',
                type: 'AuthProvider',
              },
              {
                name: 'baseUrl',
                type: 'string',
              },
              {
                name: 'apiKey',
                type: 'string',
              },
            ],
            statements: 'super(authProvider, baseUrl, apiKey)',
          },
        ],
        isExported: true,
      });

      const endpoints: [
        string,
        OpenAPIV3.OperationObject & { path: string },
      ][] = methods?.flatMap((m) =>
        Object.entries(m.endpoints)
          .filter(([key]) =>
            [
              'post',
              'get',
              'put',
              'patch',
              'delete',
              'options',
              'head',
            ].includes(key),
          )
          .map(([h, endpoint]) => [
            h,
            {
              ...(endpoint as any),
              path: m.path,
            },
          ]),
      ) as any;

      for (const [httpMethod, endpoint] of endpoints) {
        const methodName = endpoint.operationId?.split('.')[1];
        invariant(methodName, 'Method name must be defined');

        const method = ctrlClass.addMethod({
          name: methodName,
          isAsync: true,
          scope: Scope.Public,
          returnType: 'Promise<any>',
        });

        const parameters = method.addParameter({
          name: 'parameters',
        });

        let bodyType = 'undefined';
        let parametersType = 'undefined';
        let headersType = 'undefined';
        let queryType = 'undefined';

        if (endpoint.requestBody && 'content' in endpoint.requestBody) {
          const schema =
            endpoint.requestBody.content['application/json']?.schema;
          if (schema && Object.keys(schema).length > 0) {
            if ('$ref' in schema) {
              const end = schema.$ref.split('/').pop();
              bodyType = `definitions.${end}`;
            } else {
              bodyType = 'any';
            }
          }
        }

        if (endpoint.parameters) {
          const parameters: Record<string, OpenAPIV3.ParameterObject[]> =
            Object.groupBy(
              endpoint.parameters.filter((i) =>
                'name' in i
                  ? i.name !== 'X-Api-Key' && i.name !== 'Authorization'
                  : true,
              ),
              (item) => ('in' in item ? item.in : 'ref'),
            ) as any;
          if (parameters.path && parameters.path.length > 0) {
            parametersType = await this.generateParametersType(
              'headers',
              parameters.path,
            );
          }
          if (parameters.header && parameters.header.length > 0) {
            headersType = await this.generateParametersType(
              'headers',
              parameters.header,
            );
          }
          if (parameters.query && parameters.query.length > 0) {
            queryType = await this.generateParametersType(
              'headers',
              parameters.query,
            );
          }
        }

        const fakeParameter = method.addParameter({
          name: 'todelete',
          type: 'undefined',
        });

        const type = `RequestParams<${parametersType}, ${queryType}, ${headersType}, ${bodyType}>`;
        if (fakeParameter.getType().isAssignableTo(parameters.getType())) {
          parameters.setType(type + ' | undefined');
        } else {
          parameters.setType(type);
        }

        fakeParameter.remove();

        const successResponse = endpoint.responses?.['200'];

        let returnType = 'any';
        if (successResponse && 'content' in successResponse) {
          const schema = successResponse.content?.['application/json']?.schema;
          if (schema && Object.keys(schema).length > 0) {
            if ('$ref' in schema) {
              const end = schema.$ref.split('/').pop();
              method.setReturnType(`Promise<definitions.${end}>`);
              returnType = `definitions.${end}`;
            }
          }
        }

        method.setBodyText((codeWriter) => {
          codeWriter
            .writeLine(
              `return this.invoke<${returnType}>('${endpoint.path}', {`,
            )
            .indent(() => {
              codeWriter.writeLine(`method: '${httpMethod.toUpperCase()}',`);
              codeWriter.writeLine(`parameters,`);
            })
            .writeLine('});');
        });
      }

      this.rootDir.createSourceFile(
        'http-base.ts',
        await this.getTemplate('http-base.ts'),
        { overwrite: true },
      );
      this.rootDir.createSourceFile(
        'package.json',
        await this.getTemplate('package.json'),
        { overwrite: true },
      );
      this.rootDir.createSourceFile(
        'tsconfig.json',
        await this.getTemplate('tsconfig.json'),
        { overwrite: true },
      );
      this.rootDir.createSourceFile(
        'auth-provider.ts',
        await this.getTemplate('auth-provider.ts'),
        { overwrite: true },
      );
      this.rootDir.createSourceFile(
        'admin-auth-provider.ts',
        await this.getTemplate('admin-auth-provider.ts'),
        { overwrite: true },
      );
      this.rootDir.createSourceFile(
        'static-auth-provider.ts',
        await this.getTemplate('static-auth-provider.ts'),
        { overwrite: true },
      );
      this.rootDir.createSourceFile(
        'README.md',
        await this.getTemplate('readme.md'),
        { overwrite: true },
      );
    }

    await this.project.save();
    await this.build();
  }

  private async getTemplate(name: string) {
    return Bun.file(
      path.join(__dirname, '..', 'templates', 'typescript', name),
    ).text();
  }
}
