/**
 * Test Service
 * @module test
 * @path /test
 */
class TestService {
  /**
   * Get current time
   * @route {get} /time
   */
  @log
  async getTime() {
    return new Date().toISOString();
  }

  /**
   * Create an order
   * @route {post} /order
   */
  @transaction
  @validate
  async createOrder() {
    return { id: 1 };
  }
}

module.exports = TestService; 