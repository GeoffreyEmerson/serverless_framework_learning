import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import cors from '@middy/http-cors';
import createError from 'http-errors';
import { getAuctionById } from "./getAuction";
import { uploadPictureToS3 } from "../lib/uploadPictureToS3";
import { setPictureUrl } from "../lib/setPictureUrl";
import uploadAuctionPictureSchema from '../lib/schemas/uploadAuctionPicture';

const base64regex = /^(data:image\/\w+;base64,)?([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

async function uploadAuctionPicture(event) {
    const { id } = event.pathParameters;
    const { email } = event.requestContext.authorizer;
    const auction = await getAuctionById(id);

    if ( email != auction.seller ) {
        throw new createError.Forbidden(`Only seller may add picture`);
    }
    
    const base64input = event.body.replace(/^data:image\/\w+;base64,/, '');
    
    if (!base64regex.test(base64input)) {
        throw new createError.Forbidden(`picture data must be base64 encoded`);
    }

    const buffer = Buffer.from(base64input, 'base64');
    
    try {
        const pictureUrl = await uploadPictureToS3(auction.id + '.jpg', buffer);
        const updatedAuction = await setPictureUrl(id, pictureUrl);
        console.log('Uploaded Picture available at:', pictureUrl);
    
        return {
            statusCode: 200,
            body: JSON.stringify({updatedAuction})
        };
    } catch (error) {
        console.log(error);
        throw new createError.InternalServerError(error)
    }
}

// This function handles large raw base64 strings in the body, so it will not use the common middleware
export const handler = middy(uploadAuctionPicture)
    .use(httpErrorHandler())
    .use(validator({ inputSchema: uploadAuctionPictureSchema }))
    .use(cors());
