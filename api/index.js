const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8926562593:AAHYoAX04CQ649PuOEVqwuWBY8pdbKBrhHc';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; 

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

app.get('/', (req, res) => {
  res.send('Server Bot Telegram Gaspoll Vercel Aktif!');
});

app.post('/api', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.text) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = message.text.trim();

    const PREFIX = "GASPOLL CEK,";

    if (text.toUpperCase().startsWith(PREFIX)) {
      const rawPlat = text.substring(PREFIX.length).trim();
      let listPlat = rawPlat.split(",").map(p => p.trim().toUpperCase()).filter(p => p.length > 0);

      if (listPlat.length === 0) {
        await sendTelegramMessage(chatId, "⚠️ Mohon sertakan plat nomor yang ingin dicek.\n*Contoh:* `Gaspoll Cek, BA 8856 QX`");
        return res.sendStatus(200);
      }

      let replyMessage = "";
      const sheetRows = await fetchGoogleSheetData();

      for (let i = 0; i < listPlat.length && i < 10; i++) {
        const platTarget = listPlat[i];
        const data = searchInRows(sheetRows, platTarget);

        if (data) {
          replyMessage += `*${platTarget} GASPOLL*\n` +
                          `Nama Pemilik : ${data.nama}\n` +
                          `No. HP : ${data.nohp}\n` +
                          `Alamat : ${data.alamat}\n` +
                          `Status TL : ${data.status_tl}\n` +
                          `Status Bayar : ${data.status_bayar}`;
        } else {
          replyMessage += `*${platTarget} Tidak ditemukan!*`;
        }

        if (i < listPlat.length - 1 && i < 9) {
          replyMessage += "\n------------\n";
        }
      }

      await sendTelegramMessage(chatId, replyMessage);
    } else if (text === '/start') {
      await sendTelegramMessage(chatId, "Selamat datang! Kirim pesan dengan format:\n`Gaspoll Cek, BA 8856 QX, BA 3238 TO`");
    }
  } catch (err) {
    console.error("Error Processing Request:", err);
  }
  return res.sendStatus(200);
});

async function fetchGoogleSheetData() {
  if (!SPREADSHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) return [];
  
  const serviceAccountAuth = new JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  return rows;
}

function searchInRows(rows, platTarget) {
  const targetClean = platTarget.replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  
  for (const row of rows) {
    const platDiSheet = String(row._rawData[0] || '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    if (platDiSheet === targetClean) {
      return {
        nama: row._rawData[1] || '-',
        nohp: row._rawData[2] || '-',
        alamat: row._rawData[3] || '-',
        status_tl: row._rawData[4] || '-',
        status_bayar: row._rawData[5] || '-'
      };
    }
  }
  return null;
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  });
}

module.exports = app;