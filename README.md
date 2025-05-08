# xxd-doc-parser-next

Enhanced XXD API documentation parser with decorator support.

## Features

- Full support for ES decorators (both legacy and stage 3 proposal)
- Uses @babel/parser for better JavaScript syntax support
- Maintains compatibility with existing xxd-doc-parser API
- Improved error messages and debugging information

## Installation

```bash
npm install xxd-doc-parser-next --save-dev
```

## Usage

```js
const parser = require('xxd-doc-parser-next');

// Parse a directory containing API files
const docs = parser('./src/services');

// The result contains the API documentation structure
console.log(docs);
```

## Decorator Support

The parser now fully supports ES decorators in your API files:

```js
/**
 * User Service
 * @module user
 * @path /user
 */
class UserService {
  /**
   * Create a user
   * @route {post} /
   */
  @validate
  @transaction
  async createUser(params) {
    // ...
  }
}
```

## Migration from xxd-doc-parser

This is a drop-in replacement for xxd-doc-parser. Simply update your package.json dependency:

```diff
{
  "devDependencies": {
-   "xxd-doc-parser": "^1.0.2"
+   "xxd-doc-parser-next": "^1.0.0"
  }
}
```

## License

MIT
