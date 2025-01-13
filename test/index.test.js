const test = require('ava')
const fs = require('fs')
const util = require('util')
const sinon = require('sinon')
const { v4: uuidv4 } = require('uuid')
const handler = require('..')

const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
const unlink = util.promisify(fs.unlink)

async function run(content, inputs, otherOptions = {}) {
  const fileName = `${uuidv4()}.txt`
  if (!inputs) inputs = {}
  inputs.include_files = [fileName]

  try {
    await writeFile(fileName, content)

    const listAll = sinon
      .stub()
      .returns([{ runtime: 'js', extension: '.js', srcFile: fileName }])

    const utils = otherOptions.mockUtils
      ? otherOptions.mockUtils(fileName)
      : {
          functions: { listAll },
          build: { failBuild: console.log },
          status: { show: console.log },
        }

    const returnCode = await handler.processFiles({ inputs, utils })

    const transformedFileContent = await readFile(fileName, 'utf8')

    await unlink(fileName)

    return {
      returnCode,
      transformedFileContent,
    }
  } catch (error) {
    console.error('Error during test run:', error)
    await unlink(fileName)
    throw error
  }
}

test('empty file', async (t) => {
  t.is((await run('', {})).transformedFileContent, '')
})

test('default inputs', async (t) => {
  process.env.VAR_1 = 'foo'
  process.env.VAR_2 = 'bar'

  t.is(
    (await run(`() => {process.env.VAR_1;process.env.VAR_2;};`))
      .transformedFileContent,
    `() => {"foo";"bar";};`
  )
})

test('inputs with include_vars', async (t) => {
  process.env.VAR_1 = 'foo'
  process.env.VAR_2 = 'bar'

  t.is(
    (
      await run(`() => {process.env.VAR_1;process.env.VAR_2;};`, {
        include_vars: ['VAR_1'],
      })
    ).transformedFileContent,
    `() => {"foo";process.env.VAR_2;};`
  )
})

test('inputs with exclude_vars', async (t) => {
  process.env.VAR_1 = 'foo'
  process.env.VAR_2 = 'bar'

  t.is(
    (
      await run(`() => {process.env.VAR_1;process.env.VAR_2;};`, {
        exclude_vars: ['VAR_1'],
      })
    ).transformedFileContent,
    `() => {process.env.VAR_1;"bar";};`
  )
})

test('inputs with both include_vars and exclude_vars', async (t) => {
  process.env.VAR_1 = 'foo'
  process.env.VAR_2 = 'bar'

  t.is(
    (
      await run(`() => {process.env.VAR_1;process.env.VAR_2;};`, {
        exclude_vars: ['VAR_1'],
        include_vars: ['VAR_2'],
      })
    ).transformedFileContent,
    `() => {process.env.VAR_1;"bar";};`
  )
})

test('inputs without buildEvent', async (t) => {
  t.deepEqual(handler({}), { onPreBuild: handler.processFiles })
})

test('inputs with buildEvent', async (t) => {
  t.deepEqual(handler({ buildEvent: 'onBuild' }), {
    onBuild: handler.processFiles,
  })
})
