require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { WebClient } = require('@slack/web-api');
const config = require('./config');
const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });
const slackClient = new WebClient(config.SLACK_BOT_TOKEN);

app.use(express.json()); // For parsing JSON request bodies

// 🔹 File Upload Endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const channel = req.body.channel;
        const filename = req.file.originalname;
        if (!channel) {
            return res.status(400).json({ error: 'Channel is required' });
        }

        const fileContent = fs.readFileSync(req.file.path);
        const externalUrlResponse = await slackClient.files.getUploadURLExternal({
            token: config.SLACK_BOT_API_TOKEN,
            filename: filename,
            length: fileContent.length,
        });

        const uploadUrl = externalUrlResponse.upload_url;
        const fileId = externalUrlResponse.file_id;

        await axios.post(uploadUrl, fileContent, {
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        });

        const result = await slackClient.files.completeUploadExternal({
            token: config.SLACK_BOT_API_TOKEN,
            files: [{ id: fileId, title: filename }],
            channel_id: config.channel_ids[channel],
            initial_comment: 'Parsed Failed Logs:',
        });

        fs.unlinkSync(req.file.path); // Delete local file after upload
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Start the Express server
app.listen(port, () => console.log(`Slack service running on port ${port}`));