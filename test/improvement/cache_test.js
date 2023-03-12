const { aggregateData } = require('./cache');

describe('Custom Aggregation', () => {
  describe('aggregateData()', () => {
    it('should filter out documents that do not match the initial filter criteria', async () => {
      const data = [
        { _id: 1, name: 'John Doe', age: 25 },
        { _id: 2, name: 'Jane Smith', age: 30 },
        { _id: 3, name: 'Bob Johnson', age: 40 },
      ];
      const pipeline = [
        { $match: { age: { $gte: 30 } } },
        { $project: { name: 1, age: 1 } },
      ];
      const result = await aggregateData(data, pipeline);

      expect(result.length).toBe(2);
      expect(result).toEqual([
        { name: 'Jane Smith', age: 30 },
        { name: 'Bob Johnson', age: 40 },
      ]);
    });

    it('should cache the result of the aggregation pipeline', async () => {
      const data = [
        { _id: 1, name: 'John Doe', age: 25 },
        { _id: 2, name: 'Jane Smith', age: 30 },
        { _id: 3, name: 'Bob Johnson', age: 40 },
      ];
      const pipeline = [
        { $match: { age: { $gte: 30 } } },
        { $project: { name: 1, age: 1 } },
      ];

      const result1 = await aggregateData(data, pipeline);
      const result2 = await aggregateData(data, pipeline);

      expect(result1).toEqual(result2);
    });

    it('should use disk-based processing if the data set is too large to fit in memory', async () => {
      const data = [];
      for (let i = 0; i < 1000000; i++) {
        data.push({ _id: i, value: i % 10 });
      }
      const pipeline = [
        { $match: { value: 5 } },
        { $project: { _id: 1 } },
      ];
      const result = await aggregateData(data, pipeline);

      expect(result.length).toBe(100000);
      expect(result[0]._id).toBe(5);
      expect(result[99999]._id).toBe(999995);
    });
  });
});
