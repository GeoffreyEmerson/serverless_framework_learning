import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

export async function closeAuction(auction) {
    const params = {
        TableName: process.env.AUCTIONS_TABLE_NAME,
        Key: { id: auction.id },
        UpdateExpression: 'set #status = :status',
        ExpressionAttributeValues: {
            ':status': 'CLOSED'
        },
        ExpressionAttributeNames: {
            '#status': 'status'
        }
    };

    await dynamodb.update(params).promise();

    const { title, seller, highestBid } = auction;
    const { amount, bidder } = highestBid;

    if (bidder && amount > 0) {
        const notifySeller = sqs.sendMessage({
            QueueUrl: process.env.MAIL_QUEUE_URL,
            MessageBody: JSON.stringify({
                recipient: seller,
                subject: 'Your item has been sold!',
                body: `Success! Your item "${title}" has sold for $${amount}.`
            })
        }).promise();
    
        const notifyBidder = sqs.sendMessage({
            QueueUrl: process.env.MAIL_QUEUE_URL,
            MessageBody: JSON.stringify({
                recipient: bidder,
                subject: 'You won an auction!',
                body: `By Grapthar's Hammer, what savings. You won the auction for "${title}" for $${amount}.`
            })
        }).promise();
    
        return Promise.all([notifySeller, notifyBidder]);
    }

    await sqs.sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
            recipient: seller,
            subject: 'Your item expired with no bids.',
            body: `Sorry! Your item "${title}" did not find a buyer. Never give up, never surrender!`
        })
    }).promise();

    return;
}