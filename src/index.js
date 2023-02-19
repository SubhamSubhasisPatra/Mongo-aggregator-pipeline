class DataAggregator {
  constructor(pipeline) {
    this.pipeline = pipeline;
  }

  /**
   * @description: Aggregate data using the specified pipeline stages
   * @param data: An array of objects or an async generator function that returns input data
   * @returns: A Promise that resolves to the aggregated data
   */
  async aggregate(data) {
    // If data is not an array, assume it is an async generator
    // if (!Array.isArray(data)) {
    //   data = this._readAsyncGenerator(data);
    // }

    // Apply each pipeline stage to the data
    for (const stage of this.pipeline) {
      if (stage.$match) {
        data = this._match(data, stage.$match);
      } else if (stage.$group) {
        data = this._group(data, stage.$group);
      } else if (stage.$project) {
        data = this._project(data, stage.$project);
      } else if (stage.$sort) {
        data = this._sort(data, stage.$sort);
      } else {
        throw new Error(`Unknown pipeline stage: ${Object.keys(stage)[0]}`);
      }
    }

    return data;
  }

  /**
   * @private: Read data from an async generator and return an array of objects
   * @param generator: The async generator function that yields input data
   * @returns: A Promise that resolves to an array of objects
   */
  async _readAsyncGenerator(generator) {
    const data = [];
    let batch = [];

    for await (const item of generator()) {
      batch.push(item);

      if (batch.length === 10) {
        data.push(...batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      data.push(...batch);
    }

    return data;
  }

  /**
   * @private: Filter the data based on the given match condition
   * @param data: An array of objects to filter
   * @param filter: The match condition to apply
   * @returns: The filtered data
   */
  _match(data, filter) {
    return data.filter(doc => {
      for (const key in filter) {
        const filterValue = filter[key];
        const docValue = doc[key];

        if (typeof filterValue === 'object') {
          for (const operator in filterValue) {
            const opValue = filterValue[operator];

            switch (operator) {
              case '$eq':
                if (docValue !== opValue) {
                  return false;
                }
                break;

              case '$ne':
                if (docValue === opValue) {
                  return false;
                }
                break;

              case '$gt':
                if (docValue <= opValue) {
                  return false;
                }
                break;

              case '$gte':
                if (docValue < opValue) {
                  return false;
                }
                break;

              case '$lt':
                if (docValue >= opValue) {
                  return false;
                }
                break;

              case '$lte':
                if (docValue > opValue) {
                  return false;
                }
                break;

              default:
                throw new Error(`Unknown operator: ${operator}`);
            }
          }
        } else {
          if (docValue !== filterValue) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * @description Perform aggregation on the given data set
   * @param {*} funcName | Name of the aggregation function
   * @param {*} data | Data array
   * @returns
   */
  _aggregationHandler(funcName, data) {
    switch (funcName) {
      case '$sum':
        if (data.length === 0) {
          return 0;
        }
        if (typeof data[0] === 'object') {
          return data.length;
        }
        return data.reduce((acc, val) => acc + val, 0);
      case '$avg':
        return ((data.reduce((acc, val) => acc + val, 0) / data.length)) / 2;
      case '$min':
        return Math.min(...data);
      case '$max':
        return Math.max(...data);
      default:
        throw new Error(`Unknown aggregate function: ${funcName}`);
    }
  }

  /**
   *
   * @param {*} val Mongo aggregation key
   * @returns
   */
  $extractor(val) {
    return val === 1 ? 1 : val.split('$')[1];
  }

  /**
   * @private: Group the data based on the given key
   * @param data: An array of objects to group
   * @param key: The key to group by
   * @returns: The grouped data
   */
  _group(data, group) {
    const groups = {};
    //NOTE: Eanble this like for obect like grouping
    // let genGrpKey = this.$extractor(Object.values(group['_id'])[0]);
    let genGrpKey = this.$extractor(group['_id']);

    for (const doc of data) {
      const groupValue = doc[genGrpKey];
      if (!groups[groupValue]) {
        groups[groupValue] = [doc];
      } else {
        groups[groupValue].push(doc);
      }
    }

    const result = [];

    for (const groupKey in groups) {

      const groupDocs = groups[groupKey];
      const groupResult = { [genGrpKey]: groupKey };

      for (const field in group) {
        if (field !== '_id') {

          let projectionAlias = field;
          let dbField = this.$extractor(Object.values(group[projectionAlias])[0]);

          const aggregateFunction = group[projectionAlias];
          const fieldValues = dbField === 1 ? groupDocs : groupDocs.map(doc => doc[dbField]);
          let aggregateResult;

          if (typeof aggregateFunction === 'string') {

            aggregateResult = this._aggregationHandler(aggregateFunction, fieldValues);

          } else if (typeof aggregateFunction === 'object') {

            const funcName = Object.keys(aggregateFunction)[0];
            const funcArgs = Object.values(aggregateFunction)[0];
            aggregateResult = this._aggregationHandler(funcName, fieldValues);

          } else {
            throw new Error(`Invalid aggregate function type: ${typeof aggregateFunction}`);
          }

          groupResult[projectionAlias] = aggregateResult;
        }
      }

      result.push(groupResult);
    }

    return result;
  }


  /**
   * @private: Project the specified fields from the data
   * @param data: An array of objects to project
   * @param projection: An object specifying the fields to project
   * @returns: The projected data
   */
  _project(data, projection) {
    const fields = Object.keys(projection);
    return data.map(doc => {
      const newDoc = {};
      for (const field of fields) {
        const value = projection[field];
        if (field in doc) {
          if (typeof value === 'string' || typeof value === 'number') {
            newDoc[field] = doc[field];
          } else if (typeof value === 'object') {
            const operator = Object.keys(value)[0];
            const target = value[operator];
            switch (operator) {
              case '$add':
                newDoc[field] = doc[target[0]] + doc[target[1]];
                break;
              case '$subtract':
                newDoc[field] = doc[target[0]] - doc[target[1]];
                break;
              case '$multiply':
                newDoc[field] = doc[target[0]] * doc[target[1]];
                break;
              case '$divide':
                newDoc[field] = doc[target[0]] / doc[target[1]];
                break;
              default:
                throw new Error(`Unknown projection operator: ${operator}`);
            }
          }
        }
      }
      return newDoc;
    });
  }

  /**
   * @private: Sort the data based on the given sort fields
   * @param data: An array of objects to sort
   * @param sortFields: The sort fields to apply
   * @returns: The sorted data
   */
  _sort(data, sortFields) {
    return data.sort((a, b) => {
      for (const [field, order] of Object.entries(sortFields)) {
        const aValue = a[field];
        const bValue = b[field];

        if (aValue === bValue) {
          continue;
        }

        const comparison = order === 1 ? 1 : -1;

        if (aValue > bValue) {
          return comparison;
        } else {
          return -comparison;
        }
      }

      return 0;
    });
  }


}

module.exports = DataAggregator;
