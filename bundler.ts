#!/usr/bin/env node
import * as path from 'path'
import * as fs from 'fs'
import * as babel from '@babel/core'
import { parse } from "@babel/parser"
import traverse from "@babel/traverse"

type DepRelation = { key: string, deps: string[], code: string }

const depRelation: DepRelation[] = []

const collectCodeAndDeps = (filepath: string) => {
  if(depRelation.find(item => item.key === filepath)) {
    return
  }
  const code = fs.readFileSync(filepath).toString()
  const babelResult = babel.transform(code, {
    presets: ['@babel/preset-env']
  })
  const item:DepRelation = { key: filepath, deps: [], code: babelResult?.code || ''}
  depRelation.push(item)

  const ast = parse(code, { sourceType: 'module' })
  traverse(ast, {
    enter: nodePath => {
      if (nodePath.node.type === 'ImportDeclaration') {
        const depAbsolutePath = path.resolve(path.dirname(filepath), nodePath.node.source.value)
        item.deps.push(depAbsolutePath)
        collectCodeAndDeps(depAbsolutePath)
      }
    }
  })
}

function generateCode() {
    let code = ''
    code += 'var depRelation = [' + depRelation.map(item => {
      const { key, deps, code } = item
      return `{
        key: ${JSON.stringify(key)}, 
        deps: ${JSON.stringify(deps)},
        code: function(require, module, exports){
          ${code}
        }
      }`
    }).join(',') + '];\n'
    code += 'var modules = {};\n'
    code += `execute(depRelation[0].key)\n`
    code += `
    function execute(key) {
      if (modules[key]) { return modules[key] }
      var item = depRelation.find(i => i.key === key)
      if (!item) { throw new Error(\`\${item} is not found\`) }
      var pathToKey = (path) => {
        var dirname = key.substring(0, key.lastIndexOf('/') + 1)
        var theKey = (dirname + path).replace(\/\\.\\\/\/g, '').replace(\/\\\/\\\/\/, '/')
        return theKey
      }
      var require = (path) => {
        return execute(pathToKey(path))
      }
      modules[key] = { __esModule: true }
      var module = { exports: modules[key] }
      item.code(require, module, module.exports)
      return modules[key]
    }
    `
    return code
  }

const entry = path.resolve('./', process.argv[2] || 'index.js')

collectCodeAndDeps(entry)

fs.writeFileSync(path.resolve('./', 'bundle.js'), generateCode())