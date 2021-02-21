"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
var babel = __importStar(require("@babel/core"));
var parser_1 = require("@babel/parser");
var traverse_1 = __importDefault(require("@babel/traverse"));
var depRelation = [];
var collectCodeAndDeps = function (filepath) {
    if (depRelation.find(function (item) { return item.key === filepath; })) {
        return;
    }
    var code = fs.readFileSync(filepath).toString();
    var babelResult = babel.transform(code, {
        presets: ['@babel/preset-env']
    });
    var item = { key: filepath, deps: [], code: (babelResult === null || babelResult === void 0 ? void 0 : babelResult.code) || '' };
    depRelation.push(item);
    var ast = parser_1.parse(code, { sourceType: 'module' });
    traverse_1.default(ast, {
        enter: function (nodePath) {
            if (nodePath.node.type === 'ImportDeclaration') {
                var depAbsolutePath = path.resolve(path.dirname(filepath), nodePath.node.source.value);
                item.deps.push(depAbsolutePath);
                collectCodeAndDeps(depAbsolutePath);
            }
        }
    });
};
function generateCode() {
    var code = '';
    code += 'var depRelation = [' + depRelation.map(function (item) {
        var key = item.key, deps = item.deps, code = item.code;
        return "{\n        key: " + JSON.stringify(key) + ", \n        deps: " + JSON.stringify(deps) + ",\n        code: function(require, module, exports){\n          " + code + "\n        }\n      }";
    }).join(',') + '];\n';
    code += 'var modules = {};\n';
    code += "execute(depRelation[0].key)\n";
    code += "\n    function execute(key) {\n      if (modules[key]) { return modules[key] }\n      var item = depRelation.find(i => i.key === key)\n      if (!item) { throw new Error(`${item} is not found`) }\n      var pathToKey = (path) => {\n        var dirname = key.substring(0, key.lastIndexOf('/') + 1)\n        var theKey = (dirname + path).replace(/\\.\\//g, '').replace(/\\/\\//, '/')\n        return theKey\n      }\n      var require = (path) => {\n        return execute(pathToKey(path))\n      }\n      modules[key] = { __esModule: true }\n      var module = { exports: modules[key] }\n      item.code(require, module, module.exports)\n      return modules[key]\n    }\n    ";
    return code;
}
var entry = path.resolve('./', process.argv[2] || 'index.js');
collectCodeAndDeps(entry);
fs.writeFileSync(path.resolve('./', 'bundle.js'), generateCode());
// console.log('result', depRelation)
