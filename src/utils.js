const crypto = require('crypto');
const doctrine = require('doctrine');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const fs = require('fs');

function getSourceCode(filename) {
  const text = fs.readFileSync(filename, 'utf-8');
  return text;
}

function parseJSDoc(commentText) {
  const doc = doctrine.parse(commentText, { unwrap: true });
  return {
    title() {
      return doc.description
        .trim()
        .split('\n')[0]
        .trim();
    },
    has(tagName) {
      const index = doc.tags.findIndex(tag => tag.title === tagName);
      return index !== -1;
    },
    module() {
      const tag = doc.tags.find(tag => tag.title === 'module');
      return tag ? tag.name : '';
    },
    text(tagName) {
      const tag = doc.tags.find(tag => tag.title === tagName);
      return tag ? tag.description.trim() : '';
    },
    textArray(tagName) {
      const tags = doc.tags.filter(tag => tag.title === tagName);
      return tags.map(tag => tag.description);
    },
    customArray(tagName, mapper) {
      const tags = doc.tags.filter(tag => tag.title === tagName);
      return tags.map(mapper);
    },
  };
}

function hash(str, map = {}) {
  const md5 = crypto.createHash('md5');
  map[str] = map[str] ? map[str] + 1 : 1;
  md5.update(`${str}:${map[str]}`);
  return md5.digest('hex').slice(0, 6);
}

function parseMiddleware(tag) {
  const match = tag.description.match(/^\s*\{([^}]+)\}(.*?)(?:\n|$)/);
  if (match) {
    return { name: match[1].trim(), args: match[2].trim() };
  }
  throw new Error(
    `${JSON.stringify(`@middleware ${tag.description}`)} is not valid middleware definition`
  );
}

function parseRoute(tag) {
  const match = tag.description.match(/^\s*\{([^}]+)\}(.+?)(?:\n|$)/);
  if (match) {
    return {
      method: match[1].trim().toUpperCase(),
      path: match[2].trim(),
      toName() {
        return `${this.method.toLowerCase()}:${this.path}`;
      },
    };
  }
  throw new Error(`${JSON.stringify(`@route ${tag.description}`)} is not valid route definition`);
}

function parseParam(tag) {
  // console.log('--- Parsing Param Tag ---');
  // console.log('Full tag object:', JSON.stringify(tag, null, 2));
  // console.log('Tag type object:', JSON.stringify(tag.type, null, 2));

  // Determine if the parameter is optional and get the actual type expression
  let isOptional = false;
  let typeExpression = tag.type; // Assume non-optional initially

  if (tag.type && tag.type.type === 'OptionalType') {
    isOptional = true;
    typeExpression = tag.type.expression; // Get the actual type from inside OptionalType
  }

  // Proceed only if we have a valid type expression and the name starts with 'params.'
  if (typeExpression && tag.name && tag.name.startsWith('params.')) {
    const paramData = {
      // Convert the *actual* type expression to string
      type: doctrine.type.stringify(typeExpression),
      name: tag.name.slice(7), // Removes 'params.' prefix
      description: tag.description || '',
      // Set the optional flag based on our check
      optional: isOptional,
    };
    return paramData;
  }

  return null;
}

function getFuncName(node) {
  let name = '';
  
  if (t.isClassMethod(node)) {
    name = node.key.name;
  } else if (t.isClassProperty(node)) {
    name = node.key.name;
  } else if (t.isFunctionDeclaration(node)) {
    name = node.id.name;
  } else if (t.isVariableDeclarator(node) && 
    (t.isFunctionExpression(node.init) || t.isArrowFunctionExpression(node.init))) {
    name = node.id.name;
  }
  
  return name;
}

exports.getSourceCode = getSourceCode;
exports.parseJSDoc = parseJSDoc;
exports.hash = hash;
exports.parseMiddleware = parseMiddleware;
exports.parseRoute = parseRoute;
exports.parseParam = parseParam;
exports.getFuncName = getFuncName;
