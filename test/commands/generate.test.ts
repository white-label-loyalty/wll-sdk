import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('generate', () => {
  it('runs generate cmd', async () => {
    const {stdout} = await runCommand('generate')
    expect(stdout).to.contain('hello world')
  })

  it('runs generate --name oclif', async () => {
    const {stdout} = await runCommand('generate --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
