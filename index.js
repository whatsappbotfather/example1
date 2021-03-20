require('dotenv').config({
    path: './.env.test'
});

const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());  

const axios = require('axios');
const TelegramAPI = require('node-telegram-bot-api');
const telegram = new TelegramAPI(process.env.TG_TOKEN);

const method_map = {
    'image': telegram.sendPhoto.bind(telegram),
    'video': telegram.sendVideo.bind(telegram),
    'document': telegram.sendDocument.bind(telegram),
    'ptt': telegram.sendAudio.bind(telegram)
};

app.post("/webhook", async (req, res) => {

    const { bot, message } = req.body || {};

    if(!bot || !message) {
        return res.status(422).send('Params error.');
    }

    let tg_message = `Bot: ${bot.name}\nWA user: ${message.contact.pushname || message.contact.name} (${message.contact.number})`;

    switch(message.type) {
        case 'chat':
            tg_message = message.body ? `${tg_message}\n\`${message.body}\`` : tg_message;

            await telegram.sendMessage(process.env.TG_CHAT_ID, tg_message, { parse_mode: 'Markdown' });

            await axios({
                method: 'POST',
                url: `${process.env.BASE_URL}/message.reply?token=${bot.token}`,
                data: {
                    chat_id: message.from,
                    message_id: message.id,
                    payload: `ECHO: ${message.body}`,
                    type: 'text'
                }
            });
            
            break;

        case 'vcard':
        case 'multi_vcard':
            tg_message = message.body ? `${tg_message}\n\`${message.body}\`` : tg_message;

            tg_message = message.vCards ? `${tg_message}\n\`${message.vCards.join('\n')}\`` : tg_message;

            await telegram.sendMessage(process.env.TG_CHAT_ID, tg_message, { parse_mode: 'Markdown' });

            break;

        case 'location': 
            const { latitude, longitude, description } = message.location;

            tg_message = description ? `${tg_message}\n\`${description}\`` : tg_message;

            await telegram.sendMessage(process.env.TG_CHAT_ID, tg_message, { parse_mode: 'Markdown' });
            await telegram.sendLocation(process.env.TG_CHAT_ID, latitude, longitude);

            await axios({
                method: 'POST',
                url: `${process.env.BASE_URL}/message.reply`,
                headers: {
                    authorization: bot.token
                },
                data: {
                    chat_id: message.contact.id,
                    message_id: message.id,
                    payload: message.location,
                    type: 'location',
                    options: {
                        caption: `ECHO: ${message.body || description}`
                    }
                }
            });

            break;

        default:
            const file = message.media.data;
            
            const fileOpts = {
            filename: message.body || message.type,
                contentType: message.media.mimetype
            };

            const method = method_map[message.type];

            tg_message = message.body ? `${tg_message}\n\`${message.body}\`` : tg_message;

            await method(process.env.TG_CHAT_ID, Buffer.from(file, 'base64'), { caption: tg_message, parse_mode: 'Markdown' }, fileOpts);

            await axios({
                method: 'POST',
                url: `${process.env.BASE_URL}/message.reply`,
                headers: {
                    authorization: bot.token
                },
                data: {
                    chat_id: message.contact.id,
                    message_id: message.id,
                    payload: { filename: message.body || message.type, ...message.media },
                    type: 'media',
                    options: {
                        caption: `ECHO: ${message.body}`,
                        sendMediaAsDocument: message.type === 'video'
                    }
                }
            });

            break;
    }

});

app.listen(process.env.PORT, () => {
    console.log(`Example app listening at http://localhost:${process.env.PORT}`);
});
