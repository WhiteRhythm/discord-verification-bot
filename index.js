// --- REQUIRED LIBRARIES ---
const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

// --- CONFIGURATION - FILL THESE IN! ---
const SPREADSHEET_ID = '1X67o_xecG5giIn25RCdqimAnZ1nqrufP-4llqiRIUTk';
const VERIFIED_ROLE_ID = '1382786113827115018'; // Make sure this is filled
const UNVERIFIED_ROLE_ID = '1383860830763745453'; // Make sure this is filled
const VERIFICATION_CHANNEL_ID = '1383862842813579294'; // Make sure this is filled
const WELCOME_CHANNEL_ID = '1382392507815563298'; // --- NEW --- Paste your new channel ID here

// --- GOOGLE AUTH SETUP ---
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

// --- DISCORD CLIENT SETUP ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

// --- EVENT: BOT IS READY ---
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}! Bot is online.`);
  try {
    const commands = [
      {
        name: 'verify',
        description: 'Verifies your student credentials to get server access.',
        options: [
          { type: 3, name: 'id', description: 'Your official student ID.', required: true },
          { type: 3, name: 'password', description: 'Your assigned password.', required: true },
        ],
      },
    ];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    console.log('Attempting to register slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );
    console.log('✅✅✅ Successfully registered slash commands!');
  } catch (error) {
    console.error('---! FAILED TO DEPLOY COMMANDS !---', error);
  }
});

// --- EVENT: NEW MEMBER JOINS ---
client.on('guildMemberAdd', async member => {
  // This part remains the same
});

// --- EVENT: SLASH COMMAND IS USED ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand() || interaction.commandName !== 'verify') return;
  await interaction.deferReply({ ephemeral: true });

  try {
    const studentId = interaction.options.getString('id');
    const password = interaction.options.getString('password');
    const member = interaction.member;

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const studentRow = rows.find(row => row.get('StudentID') === studentId);

    if (!studentRow) return interaction.editReply({ content: '❌ Student ID not found.' });
    if (studentRow.get('DiscordUserID')) return interaction.editReply({ content: '❌ This ID has already been claimed.' });
    if (studentRow.get('Password') !== password) return interaction.editReply({ content: '❌ Incorrect password.' });

    const verifiedRole = await interaction.guild.roles.fetch(VERIFIED_ROLE_ID);
    const unverifiedRole = await interaction.guild.roles.fetch(UNVERIFIED_ROLE_ID);
    
    if (verifiedRole) await member.roles.add(verifiedRole);
    if (unverifiedRole) await member.roles.remove(unverifiedRole);

    studentRow.set('DiscordUserID', member.id);
    await studentRow.save();

    // --- NEW: SEND WELCOME MESSAGE ---
    try {
      const welcomeChannel = await client.channels.fetch(WELCOME_CHANNEL_ID);
      if (welcomeChannel) {
        // The message mentions the new member so they get a notification.
        await welcomeChannel.send(`Please welcome our newest member, ${member}! Glad to have you here.`);
      }
    } catch (welcomeError) {
      console.error("Could not send welcome message. Is the WELCOME_CHANNEL_ID correct?", welcomeError);
    }
    // --- END NEW SECTION ---

    await interaction.editReply({ content: '✅ Verification Successful!' });
  } catch (error) {
    console.error('Error during verification interaction:', error);
    await interaction.editReply({ content: '❗ A bot error occurred. Please contact an admin.' });
  }
});

// --- FINAL STEP: LOGIN ---
client.login(process.env.DISCORD_TOKEN);

// --- WEB SERVER FOR HOSTING ---
// This part remains the same
const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => {
  res.send('Verification bot is alive!');
});
app.listen(port, () => {
  console.log(`UptimeRobot server listening on port ${port}`);
});
