import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  applicationId: required("DISCORD_APPLICATION_ID"),
  guildId: required("DISCORD_GUILD_ID"),
};

