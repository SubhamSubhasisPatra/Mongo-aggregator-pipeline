## Mongo Aggregatio pipe 

<p> This library will mimic the abstact view of mongo aggregatio pipe line , and it can be applied on any json stream from any stream, plug it in and it will work like a Driver level aggregator </p>

## Test Code 



    const DataAggregator = require("./aggregationPipe");



    const pipeline = [
        { $match: { color: 'green' } },
        //{ $group: { _id: { category: '$category' }, totalSale: { $sum: '$sales' } } }, 
        { $group: { _id: '$category' , totalSale: { $sum: 1 } } },
        { $group: { _id: { category: '$category' }, totalSale: { $sum: '$sales' } } },
        { $sort: { totalSale: -1 } },
        { $project: { category: 1, totalSale: 1, _id: 0 } },
    ];

    const data = [
        { category: 'Electronics', color: 'red', sales: 1000 },
        { category: 'Electronics', color: 'red', sales: 2000 },
        { category: 'Clothing', color: 'red', sales: 1500 },
        { category: 'Clothing', color: 'green', sales: 800 },
        { category: 'Food', color: 'red', sales: 500 },
        { category: 'Food', color: 'red', sales: 1200 },
    ];

    const aggregator = new DataAggregator(pipeline);

    (async () => {
        try {
            const result = await aggregator.aggregate(data);
            console.log(result);
        } catch (error) {
            console.error(error);
        }
    })();

