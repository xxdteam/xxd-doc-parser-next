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
    const doc = doctrine.parse(commentText, {unwrap: true});
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
        return {name: match[1].trim(), args: match[2].trim()};
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
    // Determine if the parameter is optional and get the actual type expression
    let isOptional = false;
    let typeExpression = tag.type; // Assume non-optional initially

    if (tag.type && tag.type.type === 'OptionalType') {
        isOptional = true;
        typeExpression = tag.type.expression; // Get the actual type from inside OptionalType
    }

    // Handle parameter formats consistently
    if (typeExpression) {
        const paramName = tag.name;
        if (paramName === 'context') {
            return null;
        }
        if (paramName === 'params') {
            return null;
        }

        // Handle params.x format - extract the actual parameter name
        if (typeExpression && paramName && tag.name.startsWith('params.')) {
            return {
                type: doctrine.type.stringify(typeExpression),
                name: paramName.slice(7), // Removes 'params.' prefix
                description: tag.description || '',
                optional: isOptional,
            };
        }
    }

    return null;
}

function parseReturn(tag) {
    if (!tag) {
        return null;
    }
    let isOptional = false;
    let typeExpression = tag.type;

    if (tag?.type?.type === 'OptionalType') {
        isOptional = true;
        typeExpression = tag.type.expression;
    }
    // desc 通过空格分割，前面叫 name 后面叫描述
    const desc = tag?.description?.trim();
    tag.name = desc?.split(' ')[0] || 'defaultResultName';
    tag.description = desc?.slice(tag?.name?.length)?.trim() || '';

    // Handle parameter formats consistently
    if (typeExpression) {
        const paramName = tag.name;
        if (paramName === 'context') {
            return null;
        }
        if (paramName === 'params') {
            return null;
        }
        if (paramName === 'returns' || paramName === 'return') {
            return null;
        }

        // Handle params.x format - extract the actual parameter name
        if (typeExpression && paramName && tag.name.startsWith('returns.')) {
            return {
                type: doctrine.type.stringify(typeExpression),
                name: paramName.slice(8), // Removes 'params.' prefix
                description: tag.description || '',
                optional: isOptional,
            };
        }
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
    } else if (t.isObjectProperty(node) && t.isIdentifier(node.key)) {
        // For object methods in any module
        name = node.key.name;
    } else if (t.isObjectMethod(node)) {
        // Handle object methods
        name = node.key.name;
    }

    return name;
}

exports.getSourceCode = getSourceCode;
exports.parseJSDoc = parseJSDoc;
exports.hash = hash;
exports.parseMiddleware = parseMiddleware;
exports.parseRoute = parseRoute;
exports.parseParam = parseParam;
exports.parseReturn = parseReturn;
exports.getFuncName = getFuncName;
