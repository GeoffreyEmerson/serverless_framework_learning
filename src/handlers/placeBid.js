import AWS from 'aws-sdk';
import commonMiddleware from '../lib/commonMiddleware';
import createError from 'http-errors';
import { getAuctionById } from './getAuction';
import validator from '@middy/validator';
import placeBidSchema from '../lib/schemas/placeBidSchema';

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function placeBid(event, context) {
    const { id } = event.pathParameters;
    const { amount } = event.body;
    const { email } = event.requestContext.authorizer;

    const auction = await getAuctionById(id);

    if ( auction.status !== 'OPEN' ) {
        throw new createError.Forbidden(`You cannot bid on closed auctions.`);
    }

    if ( amount <= auction.highestBid.amount ) {
        throw new createError.Forbidden(`Your bid must be higher than ${auction.highestBid.amount}!`);
    }

    if ( email == auction.highestBid.bidder ) {
        throw new createError.Forbidden(`You already have the highest bid!`);
    }

    if ( email == auction.seller ) {
        throw new createError.Forbidden(`Seller may not bid on their own auction`);
    }

    if ( email == auction.highestBid.bidder ) {
        throw new createError.Forbidden(`You already have the highest bid!`);
    }

    const params = {
        TableName: process.env.AUCTIONS_TABLE_NAME,
        Key: { id },
        UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
        ExpressionAttributeValues: {
            ':amount': amount,
            ':bidder': email
        },
        ReturnValues: 'ALL_NEW'
    };

    let updatedAuction;

    try {
        const result = await dynamodb.update(params).promise();

        updatedAuction = result.Attributes;
    } catch (error) {
        console.error(error);
        throw new createError.InternalServerError(error);
    }

    if (!updatedAuction) {
        throw new createError.NotFound(`Auction with ID "${id}" not found.`);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ updatedAuction }),
    };
}

export const handler = commonMiddleware(placeBid)
    .use(validator({ inputSchema: placeBidSchema }));
