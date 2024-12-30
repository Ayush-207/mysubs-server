import axios from "axios";
import Subreddit from "../models/subreddit";

async function getData(page: number, limit: number): Promise<number> {
  let count = -1;
  try {
    const response = await axios.get(
      `https://app.social-rise.com/api/subreddits?page=${page}&per_page=${limit}&sort_by=subscribers&sort_dir=desc&filters[0][field]=nsfw&filters[0][operator]=%3D&filters[0][value]=1&filters[0][type]=2&filters[1][field]=name&filters[1][operator]=not+like&filters[1][value]=u_%25&filters[1][type]=1&filters[2][field]=status&filters[2][operator]=%3C%3E&filters[2][value]=banned&filters[2][type]=1&search_fields[]=name&search_value=`,
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          "sec-ch-ua":
            '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          cookie:
            "_gcl_au=1.1.1006335183.1731094114; _ga=GA1.1.307209998.1731094114; twk_uuid_60cb618f65b7290ac6367c38=%7B%22uuid%22%3A%221.WrySPjOLr7ueQIyv0vWgFwoeSVDRSYeGQLZMzDG441yQQuhWqAfTWlFamqN0ts6v0ncLiIVY2WDcbkh3lLWI5g9Qhm0TjaK3D0lhiCyMVdq39BJzZKBaXY85F%22%2C%22version%22%3A3%2C%22domain%22%3A%22social-rise.com%22%2C%22ts%22%3A1731096122273%7D; SR_auth_token=525653f1da2e70ed%3A9205a6226e0ca661317e61c727249a69414bfa2f2dca8b723ed1f5b15bdc80db; _clck=uudxhi%7C2%7Cfqz%7C0%7C1773; _ga_MQM2KESEF5=GS1.1.1731971300.14.1.1731971323.37.0.1159260847; _clsk=l9jy25%7C1731971324098%7C2%7C1%7Cf.clarity.ms%2Fcollect",
          Referer: "https://app.social-rise.com/subreddits",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      }
    );
    count = response.data.data.length;
    const data = response.data.data;
    await Subreddit.insertMany(data);
  } catch (error: any) {
    error = true;
    if (error instanceof Error) {
      console.error("Error fetching data:", error.message);
    }
  }
  return count;
}
async () => {
  let page = 1;
  let limit = 250;
  await Subreddit.collection.drop();
  let count = await getData(page, limit);
  while (count > 0) {
    page += 1;
    count = await getData(page, limit);
  }
  console.log(page);
};

interface subreddit {
  name: string;
  niche: string;
  subscribers: number;
  title: string;
  verification: number;
  selling: number;
  watermark: number;
}

const codeValueMap = {
  Unknown: -1,
  Forbidden: 0,
  Allowed: 1,
  Required: 2,
  Optional: 3,
  Username: 4,
  Comment: 5,
  Profile: 6,
  No: 7,
} as any;

function createSubredditJson(row: string[]) {
  const subr: subreddit = {
    name: row[0],
    niche: row[1].replaceAll(",", ", "),
    subscribers: parseInt(row[2]),
    title: row[3],
    verification: codeValueMap[row[4]],
    selling: codeValueMap[row[5]],
    watermark: codeValueMap[row[6]],
  };

  return subr;
}

async function fetchInitialData() {
  await Subreddit.collection.drop();
  const fs = require("fs");
  const { parse } = require("csv-parse");
  let a = true;
  let records = [] as string[][];
  fs.createReadStream("./airtable_data1.csv")
    .pipe(parse({ delimiter: ",", from_line: 2 }))
    .on("data", function (row: any) {
      records.push(row);
    })
    .on("error", function (error: any) {
      console.log(error.message);
    })
    .on("end", async function () {
      let subreddits = [] as subreddit[];
      console.log(records[0]);
      records.forEach((record) => {
        const sub = createSubredditJson(record as string[]);
        if (sub.name) {
          subreddits.push(sub);
        }
      });
      // console.log(subreddits);
      console.log(subreddits[0]);
      await Subreddit.insertMany(subreddits);
    });
}

// fetchInitialData();
