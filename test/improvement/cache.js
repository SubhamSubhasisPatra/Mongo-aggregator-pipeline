const fs = require('fs');
const readline = require('readline');
const { Transform } = require('stream');

const inputFilePath = '/path/to/input/file.json';
const outputFilePath = '/path/to/output/file.json';

// Define the aggregation pipeline
const pipeline = [
  { $match: { /* initial filter criteria */ } },
  { $group: { _id: "$field", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
];

// Define a transform stream for the aggregation pipeline
const transformStream = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    // Perform the aggregation pipeline on the input chunk
    const result = chunk.filter(/* initial filter criteria */)
      .reduce((acc, cur) => {
        const key = cur.field;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    const output = Object.entries(result)
      .map(([key, count]) => ({ _id: key, count }));
    // Pass the output to the next stream
    callback(null, output);
  }
});

// Define a write stream for the output file
const writeStream = fs.createWriteStream(outputFilePath);

// Create a read stream for the input file
const readStream = fs.createReadStream(inputFilePath);

// Use readline to read the input file line by line
const rl = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity
});

// Process the input file line by line using the transform stream
rl.pipe(transformStream)
  // Use a writable stream to cache the output in memory
  .pipe(cacheStream())
  // Use a writable stream to write the output to disk in batches
  .pipe(batchWriteStream(writeStream, batchSize))
  .on('finish', () => {
    console.log('Aggregation completed');
  });

// Define a cache stream to store the output in memory
function cacheStream() {
  const cache = [];
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      cache.push(chunk);
      // Limit the size of the cache to avoid running out of memory
      if (cache.length > cacheSize) {
        const batch = cache.splice(0, cache.length);
        this.push(batch);
      }
      callback();
    },
    flush(callback) {
      if (cache.length > 0) {
        this.push(cache);
      }
      callback();
    }
  });
}

// Define a batch write stream to write the output to disk in batches
function batchWriteStream(writeStream, batchSize) {
  let batch = [];
  let count = 0;
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      count += chunk.length;
      batch = batch.concat(chunk);
      if (count >= batchSize) {
        writeStream.write(JSON.stringify(batch));
        batch = [];
        count = 0;
      }
      callback();
    },
    flush(callback) {
      if (batch.length > 0) {
        writeStream.write(JSON.stringify(batch));
      }
      callback();
    }
  });
}
