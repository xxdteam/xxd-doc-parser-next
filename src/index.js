const _path = require('path');
const globby = require('globby');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const utils = require('./utils');

function parseDirectory(path, basePath = path) {
  if (!basePath) {
    basePath = path;
  }

  let application = null;
  const modules = [];
  const actions = [];

  for (const file of globby.sync(`${path}/**/*.js`)) {
    const result = parseFile(file, basePath);
    if (result.application) {
      if (application) {
        throw new Error(`Expect exact one application definition, given 2 or more. (${file})`);
      }
      application = result.application;
    }
    modules.push(...result.modules);
    actions.push(...result.actions);
  }

  if (!application) {
    throw new Error('Expect exact one application definition, but not given.');
  }
  application.modules = modules;

  return application;
}

function parseFile(path, base) {
  const sourceCode = utils.getSourceCode(path);
  const hashMap = {};
  const filename = _path.relative(base, path);
  const basename = _path.basename(filename, _path.extname(filename));

  // Parse code to AST
  const ast = parser.parse(sourceCode, {
    sourceType: 'module',
    plugins: [
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods'
    ]
  });

  // Load JSDoc comments
  const comments = [];
  const commentToNode = new Map();
  const resultToNode = new Map();

  // 创建一个访问者对象来收集注释
  const visitor = {
    Program(path) {
      path.traverse({
        enter(path) {
          const node = path.node;
          if (node.leadingComments) {
            for (const comment of node.leadingComments) {
              if (comment.type === 'CommentBlock' && comment.value.startsWith('*')) {
                comments.push(comment);
                commentToNode.set(comment, node);
              }
            }
          }
        }
      });
    }
  };

  // 使用访问者对象遍历 AST
  traverse(ast, visitor);

  // Parse into spec
  let application = null;
  const modules = [];
  const actions = [];

  for (const comment of comments) {
    for (const result of parseComment(comment)) {
      const node = commentToNode.get(comment);
      resultToNode.set(result, node);
      if (result.type === 'application') {
        if (application) {
          throw new Error(`Expect exact one application definition, given 2 or more. (${path})`);
        }
        application = result;
      } else if (result.type === 'module') {
        modules.push(result);
      } else if (result.type === 'action') {
        actions.push(result);
        const moduleDefinition = modules.find(mod => {
          const moduleNode = resultToNode.get(mod);
          let isNested = false;
          
          // 创建一个新的访问者对象来检查节点关系
          traverse(ast, {
            Program(path) {
              path.traverse({
                enter(path) {
                  if (path.node === node) {
                    let parent = path.findParent(p => p.node === moduleNode);
                    if (parent) {
                      isNested = true;
                    }
                  }
                }
              });
            }
          });
          
          return isNested;
        });
        
        if (moduleDefinition) {
          moduleDefinition.actions.push(result);
          if (moduleDefinition.path) {
            result.route.path = _path.join(moduleDefinition.path, result.route.path);
          }
        }
      }
    }
  }
  return { application, modules, actions };

  function parseComment(comment) {
    const doc = utils.parseJSDoc(comment.value);
    if (doc.has('application')) {
      return [
        {
          type: 'application',
          title: doc.title(),
          name: doc.text('application'),
          description: doc.text('description'),
          notes: doc.textArray('note').filter(Boolean),
          address: doc.text('address'),
          author: doc.text('author'),
          contact: doc.text('contact'),
          version: doc.text('version'),
        },
      ];
    } else if (doc.has('module')) {
      const moduleName = doc.module() || 'module';
      return [
        {
          type: 'module',
          title: doc.title(),
          name: `${moduleName}`,
          path: doc.text('path'),
          description: doc.text('description'),
          middlewares: doc.customArray('middleware', utils.parseMiddleware).filter(Boolean),
          notes: doc.textArray('note').filter(Boolean),
          filename: basename,
          actions: [],
        },
      ];
    } else if (doc.has('route')) {
      const routes = doc.customArray('route', utils.parseRoute);
      const funcname = utils.getFuncName(commentToNode.get(comment));
      const actionName = routes[0].toName();
      return routes.map(route => {
        const nameValue = actionName || (route && route.toName()) || 'action';
        return {
          type: 'action',
          title: doc.title(),
          name: `${nameValue.replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/, '')}`,
          description: doc.text('description'),
          notes: doc.textArray('note').filter(Boolean),
          route,
          params: doc.customArray('param', utils.parseParam).filter(Boolean),
          middlewares: doc.customArray('middleware', utils.parseMiddleware).filter(Boolean),
          filename: basename,
          funcname,
        };
      });
    }
    return [];
  }
}

module.exports = parseDirectory;
