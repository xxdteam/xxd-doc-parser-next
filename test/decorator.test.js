const assert = require('assert');
const path = require('path');
const parser = require('../src');

describe('Decorator Parser', () => {
  let result;

  before(() => {
    const testDir = path.join(__dirname, 'fixtures');
    result = parser(testDir);
  });

  it('should parse application info', () => {
    assert.equal(result.name, 'xxd-backend');
    assert.equal(result.version, '2.110.0');
    assert.equal(result.author, 'XXD Team');
  });

  it('should parse modules', () => {
    assert(Array.isArray(result.modules));
    assert(result.modules.length > 0);
    
    const testModule = result.modules.find(m => m.name.startsWith('test-'));
    assert(testModule);
    assert.equal(testModule.path, '/test');
  });

  it('should parse actions with decorators', () => {
    const testModule = result.modules.find(m => m.name.startsWith('test-'));
    assert(testModule.actions);
    assert.equal(testModule.actions.length, 2);

    const getTime = testModule.actions.find(a => a.funcname === 'getTime');
    assert(getTime);
    assert.equal(getTime.route.method, 'GET');
    assert.equal(getTime.route.path, '/test/time');

    const createOrder = testModule.actions.find(a => a.funcname === 'createOrder');
    assert(createOrder);
    assert.equal(createOrder.route.method, 'POST');
    assert.equal(createOrder.route.path, '/test/order');
  });
}); 