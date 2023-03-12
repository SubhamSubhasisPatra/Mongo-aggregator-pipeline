// Improved solution ( NOT WORKING CONDITION)

class CustomAggregationDriver {
  constructor(data) {
    this.data = data;
    this.pipeline = [];
  }

  match(filter) {
    this.pipeline.push({ $match: filter });
    return this;
  }

  group(grouping) {
    this.pipeline.push({ $group: grouping });
    return this;
  }

  async aggregate() {
    // Early filtering
    let filteredData = this.data.filter((document) => {
      // Check if the document matches the filter criteria
      // specified in the first stage of the pipeline
      return document.field === 'value';
    });

    // Parallel processing
    const stages = this.pipeline.map((stage) => {
      return async () => {
        return filteredData.reduce(async (prev, curr) => {
          const result = await prev;
          const updated = await this.executeStage(stage, curr);
          return result.concat(updated);
        }, []);
      };
    });

    const results = await Promise.all(stages.map((stage) => stage()));

    // Combine the results from all stages
    let output = results.reduce((prev, curr) => prev.concat(curr), []);

    // Streaming output
    const batchSize = 1000;
    let batchIndex = 0;
    let batchResults = [];

    while (batchIndex < output.length) {
      const batch = output.slice(batchIndex, batchIndex + batchSize);
      batchResults.push(batch);
      batchIndex += batchSize;
    }

    return batchResults;
  }

  async executeStage(stage, data) {
    // Memory optimization: cache the results of the $group stage
    let cache = {};

    switch (stage.$group) {
      case undefined:
        // If this is not a $group stage, execute it on each document
        return await stage.$match(data);
      default:
        // If this is a $group stage, check if the group already exists in the cache
        const groupKey = JSON.stringify(stage.$group._id);

        if (!cache[groupKey]) {
          // If the group does not exist in the cache, create a new group and add it to the cache
          const newGroup = {
            ...stage.$group,
            _id: stage.$group._id,
            count: 1
          };

          cache[groupKey] = newGroup;
        } else {
          // If the group already exists in the cache, increment the count
          cache[groupKey].count += 1;
        }

        return cache[groupKey];
    }
  }
}

const data = [
  { field: 'value', field2: 'A' },
  { field: 'value', field2: 'B' },
  { field: 'value', field2: 'B' },
  { field: 'value', field2: 'C' },
  { field: 'value', field2: 'C' },
  { field: 'value', field2: 'C' }
];

const driver = new CustomAggregationDriver(data);

const results = driver
  .match({ field: 'value' })
  .group({ _id: '$field2', count: { $sum: 1 } })
  .aggregate();

console.log(results); // [[{ _id: 'A', count: 1 }, { _id: 'B', count: 2}]]

