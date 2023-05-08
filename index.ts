import axios from "axios";
import { TwitterApi } from "twitter-api-v2";
import { Block, createPublicClient, http, hexToString } from "viem";
import { mainnet } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config();

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY ?? "",
  appSecret: process.env.TWITTER_APP_SECRET ?? "",
  accessToken: process.env.TWITTER_ACCESS_TOKEN ?? "",
  accessSecret: process.env.TWITTER_ACCESS_SECRET ?? "",
});

const ETH_RPC_URL = process.env.ETH_RPC_URL;
const BEACON_CHAIN_API = process.env.BEACON_CHAIN_API;
const NOUN = "⌐◨-◨";

const httpClient = createPublicClient({
  chain: mainnet,
  transport: http(ETH_RPC_URL),
});

const main = async () => {
  httpClient.watchBlocks({ onBlock: processBlock });
};

const processBlock = async (block: Block) => {
  const { timestamp } = block;

  const currentSlot = await blockTimestampToSlot(timestamp);
  const graffiti = await getGraffiti(currentSlot);

  console.log(`Slot: ${currentSlot} Graffiti: ${graffiti}`);
  if (graffiti !== undefined && graffiti.includes(NOUN)) {
    await tweetNewNounBlock(currentSlot, block, graffiti);
  }
};

const getGraffiti = async (slot: bigint) => {
  try {
    const block = await axios.get(
      `${BEACON_CHAIN_API}/eth/v2/beacon/blocks/${slot.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
    const graffitiHex = block.data.data.message.body.graffiti;

    if (
      graffitiHex ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      return;
    }

    const graffiti = hexToString(graffitiHex);
    return graffiti;
  } catch (e) {}
};

const getGenesisTimestamp = async () => {
  const genesisResponse = await axios.get(
    `${BEACON_CHAIN_API}/eth/v1/beacon/genesis`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  const genesisTime = genesisResponse.data.data.genesis_time;
  return BigInt(genesisTime);
};

const blockTimestampToSlot = async (blockTimestamp: bigint) => {
  const genesisTimestamp = await getGenesisTimestamp();
  const slot = (blockTimestamp - genesisTimestamp) / 12n;
  return slot;
};

const tweetNewNounBlock = async (
  slot: bigint,
  block: Block,
  graffiti: string
) => {
  const tweet = `New Ethereum block proposed with a ⌐◨-◨ block graffiti.\n\n\
Graffiti: ${graffiti}\n\
Slot: ${slot}\n\
Validator: ${block.miner}\n\
See the slot details below: https://beaconcha.in/slot/${slot.toString()}`;

  await twitterClient.v2.tweet(tweet);
};

main();
