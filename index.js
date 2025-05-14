// socialLookup.js
import axios from 'axios';
// import { proxies } from './proxies';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { HttpsProxyAgent } from 'https-proxy-agent';
import randomUseragent from 'random-useragent';
import * as cheerio from 'cheerio';
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Enable stealth mode to avoid bot detection
puppeteer.use(StealthPlugin());

// Set up Express with proper file paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enhanced Proxy Configuration
const proxies = {
  // Free proxie rotation (use with caution - unreliable)
  free: [
    'http://45.77.56.114:3128',
    'http://51.158.68.68:8811',
    'http://165.227.203.111:3128',
    "http://158.255.77.166:80",
    "http://41.59.90.171:80",
    "http://191.242.177.42:3128",
    "http://119.156.195.173:3128",
    "http://27.79.219.140:16000",
    "http://27.79.242.248:16000",
    "http://84.39.112.144:3128",
    "http://8.210.117.141:8888",
  ],
};

// Proxy selection strategy from environment variables or default to 'free'
const PROXY_STRATEGY = process.env.PROXY_STRATEGY || 'free'; // 'free' | 'premium'
let currentProxyIndex = 0;

const getProxy = () => {
  const proxyList = proxies[PROXY_STRATEGY];
  if (!proxyList || proxyList.length === 0) return null;
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  return proxyList[currentProxyIndex];
};

// Enhanced proxy configuration for Puppeteer
const getPuppeteerProxyArgs = () => {
  const proxyUrl = getProxy();
  if (!proxyUrl) return [];

  try {
    const { protocol, hostname, port, username, password } = new URL(proxyUrl);
    return [
      `--proxy-server=${protocol}//${hostname}:${port}`,
      `--proxy-bypass-list=<-loopback>`,
      ...(username && password ? [
        `--proxy-auth=${username}:${password}`
      ] : [])
    ];
  } catch (e) {
    console.error('Invalid proxy URL:', proxyUrl);
    return [];
  }
};

// CAPTCHA solver configuration from environment variables
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
console.log('Using CAPTCHA API key:', CAPTCHA_API_KEY ? CAPTCHA_API_KEY.substring(0, 5) + '...' : 'Not configured');

/**
 * Main lookup function with enhanced capabilities
 * @param {string} name - Person's name to search
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.useImageSearch=false] - Enable reverse image search
 * @param {string} [options.imageUrl] - URL of profile picture for image search
 * @param {boolean} [options.includeUsernameCheck=true] - Check username across platforms
 * @returns {Promise<Object>} Social media profiles found
 */
export const lookupSocialMedia = async (name, options = {}) => {
  const socialProfiles = {};
  const searchQuery = encodeURIComponent(name);

  try {
    // ===== METHOD 1: Multi-Search Engine Scraping =====
    console.log('Starting multi-search engine scraping...');

    const [googleResults, bingResults] = await Promise.all([
      scrapeGoogle(searchQuery).then(results => {
        console.log('Google search completed:', Object.keys(results).length > 0 ? 'Found profiles' : 'No profiles found');
        return results;
      }),
      scrapeBing(searchQuery)
        .then(results => {
          console.log('Bing search completed:', Object.keys(results).length > 0 ? 'Found profiles' : 'No profiles found');
          return results;
        })
        .catch(err => {
          console.warn('Bing search failed:', err.message);
          return {};
        })
    ]);

    Object.assign(socialProfiles, googleResults, bingResults);
    console.log('Multi-search engine results:', Object.keys(socialProfiles).join(', ') || 'None');

    // ===== METHOD 2: Reverse Image Search (Optional) =====
    if (options.useImageSearch && options.imageUrl) {
      console.log('Starting reverse image search...');
      try {
        const imageResults = await reverseImageSearch(options.imageUrl);
        console.log('Image search completed:', Object.keys(imageResults).length > 0 ? 'Found profiles' : 'No profiles found');
        Object.assign(socialProfiles, imageResults);
      } catch (e) {
        console.warn('Reverse image search failed:', e.message);
      }
    }

    // ===== METHOD 3: Direct Platform Searches (Fallback) =====
    console.log('Starting direct platform searches for missing profiles...');
    const platformSearches = [];

    if (!socialProfiles.facebook) {
      console.log('Searching Facebook directly...');
      platformSearches.push(
        searchFacebook(name)
          .then(url => {
            if (url) {
              console.log('Facebook profile found:', url);
              socialProfiles.facebook = url;
            } else {
              console.log('No Facebook profile found');
            }
          })
          .catch(err => console.warn('Facebook search failed:', err.message))
      );
    }

    if (!socialProfiles.instagram) {
      console.log('Searching Instagram directly...');
      platformSearches.push(
        searchInstagram(name)
          .then(url => {
            if (url) {
              console.log('Instagram profile found:', url);
              socialProfiles.instagram = url;
            } else {
              console.log('No Instagram profile found');
            }
          })
          .catch(err => console.warn('Instagram search failed:', err.message))
      );
    }

    if (!socialProfiles.linkedin) {
      console.log('Searching LinkedIn directly...');
      platformSearches.push(
        searchLinkedIn(name)
          .then(url => {
            if (url) {
              console.log('LinkedIn profile found:', url);
              socialProfiles.linkedin = url;
            } else {
              console.log('No LinkedIn profile found');
            }
          })
          .catch(err => console.warn('LinkedIn search failed:', err.message))
      );
    }

    if (!socialProfiles.twitter) {
      console.log('Searching Twitter directly...');
      platformSearches.push(
        searchTwitter(name)
          .then(url => {
            if (url) {
              console.log('Twitter profile found:', url);
              socialProfiles.twitter = url;
            } else {
              console.log('No Twitter profile found');
            }
          })
          .catch(err => console.warn('Twitter search failed:', err.message))
      );
    }

    await Promise.all(platformSearches);
    console.log('Direct platform searches completed');

    // ===== METHOD 4: Username Consistency Check =====
    if (options.includeUsernameCheck !== false && socialProfiles.instagram) {
      console.log('Starting username consistency check...');
      try {
        const username = socialProfiles.instagram.split('/').pop();
        console.log(`Checking username "${username}" across platforms...`);

        const usernameResults = await checkUsername(username);

        console.log('Username check results:',
          Object.keys(usernameResults).length > 0
            ? Object.keys(usernameResults).join(', ')
            : 'No additional profiles found'
        );

        Object.assign(socialProfiles, usernameResults);
      } catch (e) {
        console.warn('Username check failed:', e.message);
      }
    }

    console.log('All search methods completed');
    return socialProfiles;
  } catch (error) {
    console.error('Enhanced lookup error:', error);
    return {};
  }
};

// ===== Enhanced Helper Functions =====

async function scrapeBing(query) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--proxy-server=${getRandomProxy()}`]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());

    await page.goto(`https://www.bing.com/search?q=${query}+site:facebook.com+OR+site:instagram.com+OR+site:linkedin.com`, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const profiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="http"]'));
      const results = {};

      links.forEach(link => {
        const url = link.href;
        if (url.includes('facebook.com')) results.facebook = url;
        else if (url.includes('instagram.com')) results.instagram = url;
        else if (url.includes('linkedin.com')) results.linkedin = url;
        else if (url.includes('twitter.com')) results.twitter = url;
      });

      return results;
    });

    return profiles;
  } finally {
    await browser.close();
  }
}

async function searchFacebook(name) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--proxy-server=${getRandomProxy()}`]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());

    await page.goto(`https://www.facebook.com/public/${encodeURIComponent(name)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const profile = await page.evaluate(() => {
      const firstResult = document.querySelector('a[href*="/profile.php?id="], a[href*="/username"]');
      return firstResult ? firstResult.href : null;
    });

    return profile;
  } finally {
    await browser.close();
  }
}

const getRandomProxy = () => {
  const proxyList = proxies[PROXY_STRATEGY];
  if (!proxyList || proxyList.length === 0) return null;
  return proxyList[Math.floor(Math.random() * proxyList.length)];
};


/** Scrape Google with improved reliability and CAPTCHA handling */
async function scrapeGoogle(query) {
  console.log('Launching browser for Google search...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      ...getPuppeteerProxyArgs(),
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    timeout: 60000 // Increase timeout to 60 seconds
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Set random viewport to appear more human
    await page.setViewport({
      width: 1280 + Math.floor(Math.random() * 200),
      height: 800 + Math.floor(Math.random() * 200),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: Math.random() > 0.5
    });

    // Randomize mouse movements
    await page.evaluateOnNewDocument(() => {
      window.generateMouseMovement = async (element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        await new Promise(resolve => {
          const moves = 5 + Math.floor(Math.random() * 5);
          let i = 0;

          const moveMouse = () => {
            if (i >= moves) return resolve();

            const x = centerX + (Math.random() * 40 - 20);
            const y = centerY + (Math.random() * 40 - 20);

            const event = new MouseEvent('mousemove', {
              clientX: x,
              clientY: y,
              bubbles: true
            });

            document.dispatchEvent(event);
            i++;
            setTimeout(moveMouse, 100 + Math.random() * 200);
          };

          moveMouse();
        });
      };
    });

    console.log('Navigating to Google search page...');
    try {
      await page.goto(`https://www.google.com/search?q=${query}+site:facebook.com+OR+site:instagram.com+OR+site:linkedin.com+OR+site:twitter.com`, {
        waitUntil: 'networkidle2',
        timeout: 60000 // Increase timeout to 60 seconds
      });
      console.log('Successfully loaded Google search page');
    } catch (error) {
      console.error('Error loading Google search page:', error.message);
      return {}; // Return empty results on timeout
    }

    // Check and solve CAPTCHA if present
    if (await page.$('#captcha-form, .g-recaptcha')) {
      try {
        if (CAPTCHA_API_KEY) {
          await solvePuppeteerCaptcha(page);
          await page.waitForNavigation({ timeout: 10000 });
        } else {
          console.warn('CAPTCHA detected but no solver configured');
        }
      } catch (e) {
        console.warn('CAPTCHA solving failed:', e.message);
      }
    }

    // Simulate human-like scrolling
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 2000) {
            clearInterval(timer);
            resolve();
          }
        }, 100 + Math.random() * 200);
      });
    });

    const profiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="http"]'));
      const results = {};
      const domains = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com'];

      links.forEach(link => {
        try {
          const url = new URL(link.href);
          const domain = url.hostname.replace('www.', '');

          if (domains.some(d => domain.includes(d))) {
            const platform = domain.split('.')[0];
            if (!results[platform]) {
              results[platform] = url.toString();
            }
          }
        } catch (e) {
          // Invalid URL, skip
        }
      });

      return results;
    });

    return profiles;
  } finally {
    await browser.close();
  }
}

/** Search LinkedIn with improved reliability */
async function searchLinkedIn(name) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: getPuppeteerProxyArgs()
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());

    // Random delay before navigation
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    await page.goto(`https://www.google.com/search?q=site:linkedin.com/in+${encodeURIComponent(name)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    // Simulate reading behavior
    await page.waitForTimeout(1500 + Math.random() * 2000);

    const profileUrl = await page.evaluate(() => {
      const firstResult = document.querySelector('a[href*="linkedin.com/in/"]');
      return firstResult ? firstResult.href : null;
    });

    return profileUrl;
  } finally {
    await browser.close();
  }
}

/** Search Twitter via Nitter with improved reliability */
async function searchTwitter(name) {
  try {
    // Rotate between different Nitter instances
    const nitterInstances = [
      'https://nitter.net',
      'https://nitter.it',
      'https://nitter.unixfox.eu'
    ];

    const instance = nitterInstances[Math.floor(Math.random() * nitterInstances.length)];
    const response = await resilientRequest(`${instance}/search?q=${encodeURIComponent(name)}`);
    const $ = cheerio.load(response);

    // More robust selector
    const profileLink = $('.timeline-item a.username').first().attr('href');
    return profileLink ? `https://twitter.com${profileLink}` : null;
  } catch (error) {
    console.warn('Twitter search failed:', error);
    return null;
  }
}

/** Search Instagram with fallback methods */
async function searchInstagram(name) {
  try {
    // Try official API first with proper headers
    const response = await axios.get(`https://www.instagram.com/web/search/topsearch/?query=${name}`, {
      headers: {
        'User-Agent': randomUseragent.getRandom(),
        'X-IG-App-ID': '936619743392459',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    // More robust user matching
    const user = response.data.users?.find(u =>
      u.user.username.toLowerCase().includes(name.toLowerCase()) ||
      (u.user.full_name && u.user.full_name.toLowerCase().includes(name.toLowerCase()))
    );

    if (user) return `https://instagram.com/${user.user.username}`;

    // Fallback to Google search
    const browser = await puppeteer.launch({
      headless: "new",
      args: getPuppeteerProxyArgs()
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(randomUseragent.getRandom());

      await page.goto(`https://www.google.com/search?q=site:instagram.com+${encodeURIComponent(name)}`, {
        waitUntil: 'networkidle2',
        timeout: 15000
      });

      const instagramUrl = await page.evaluate(() => {
        // More specific selector
        const link = document.querySelector('a[href*="instagram.com/"][href*="/p/"]') ||
                     document.querySelector('a[href*="instagram.com/"]');
        return link ? link.href : null;
      });

      return instagramUrl;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn('Instagram search failed:', error);
    return null;
  }
}

/** Check username across multiple platforms with improved reliability */
async function checkUsername(username) {
  const sites = [
    { name: 'github', url: `https://github.com/${username}` },
    { name: 'reddit', url: `https://www.reddit.com/user/${username}` },
    { name: 'tiktok', url: `https://www.tiktok.com/@${username}` },
    { name: 'pinterest', url: `https://www.pinterest.com/${username}` },
    { name: 'flickr', url: `https://www.flickr.com/people/${username}` }
  ];

  const results = {};

  await Promise.all(sites.map(async (site) => {
    try {
      const response = await axios.head(site.url, {
        timeout: 5000,
        validateStatus: (status) => status < 400 || status === 404
      });

      if (response.status !== 404) {
        results[site.name] = site.url;
      }
    } catch (error) {
      console.warn(`Username check failed for ${site.name}:`, error.message);
    }
  }));

  return results;
}

/** Resilient request with enhanced retry logic */
async function resilientRequest(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const proxy = getProxy();
      const agent = proxy ? new HttpsProxyAgent(proxy) : null;

      const response = await axios.get(url, {
        timeout: 10000,
        httpsAgent: agent,
        headers: {
          'User-Agent': randomUseragent.getRandom(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });

      return response.data;
    } catch (error) {
      if (i === retries - 1) throw error;

      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, i) + Math.random() * 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/** CAPTCHA solver integration */
async function solvePuppeteerCaptcha(page) {
  try {
    // Check which type of CAPTCHA we're dealing with
    if (await page.$('.g-recaptcha')) {
      const sitekey = await page.$eval('.g-recaptcha', el => el.dataset.sitekey);
      const pageUrl = page.url();

      // Use 2captcha API
      const submitResponse = await axios.post('https://2captcha.com/in.php', {
        key: CAPTCHA_API_KEY,
        method: 'userrecaptcha',
        googlekey: sitekey,
        pageurl: pageUrl,
        json: 1
      }, { timeout: 10000 });

      if (!submitResponse.data.status) {
        throw new Error(submitResponse.data.request || 'Failed to submit CAPTCHA');
      }

      const captchaId = submitResponse.data.request;
      let solution = null;
      const startTime = Date.now();

      // Poll for solution
      while (Date.now() - startTime < 120000) { // 2 minute timeout
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await axios.get('https://2captcha.com/res.php', {
          params: {
            key: CAPTCHA_API_KEY,
            action: 'get',
            id: captchaId,
            json: 1
          },
          timeout: 10000
        });

        if (response.data.status === 1) {
          solution = response.data.request;
          break;
        }

        if (response.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(response.data.request || 'CAPTCHA solving failed');
        }
      }

      if (!solution) throw new Error('CAPTCHA solving timed out');

      // Inject the solution
      await page.evaluate((solution) => {
        document.getElementById('g-recaptcha-response').innerText = solution;
        const event = new Event('change', { bubbles: true });
        document.getElementById('g-recaptcha-response').dispatchEvent(event);
      }, solution);

      return solution;
    }

    throw new Error('Unsupported CAPTCHA type');
  } catch (error) {
    console.error('CAPTCHA solving failed:', error);
    throw error;
  }
}

async function reverseImageSearch(imageUrl) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--proxy-server=${getRandomProxy()}`]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());

    await page.goto(`https://images.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const profiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="linkedin.com"]'));
      const results = {};

      links.forEach(link => {
        const url = link.href;
        if (url.includes('facebook.com')) results.facebook = url;
        else if (url.includes('instagram.com')) results.instagram = url;
        else if (url.includes('linkedin.com')) results.linkedin = url;
      });

      return results;
    });

    return profiles;
  } finally {
    await browser.close();
  }
}
// Get port from environment variables or default to 5000
const port = process.env.PORT || 5000;

// Add middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default Route - serve the HTML page
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lookup Route
app.post('/lookup', async (req, res) => {
  try {
    const { name, options = {}, test = false } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }

    console.log(`\n===== SEARCH STARTED =====`);
    console.log(`Searching for: ${name}`);
    console.log(`Options:`, options);
    console.log(`Test mode: ${test ? 'ON' : 'OFF'}`);
    console.time('Search completed in');

    let results;

    // Test mode returns mock data without making external requests
    if (test) {
      console.log('Using test mode - returning mock data');

      // Generate realistic social media links based on the name
      const nameParts = name.split(' ');
      const firstName = nameParts[0].toLowerCase();
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : '';

      // Generate variations of usernames that are commonly used
      const variations = {
        // Common Facebook username patterns
        facebookVariations: [
          `${firstName}.${lastName}`,
          `${firstName}.${lastName}.${Math.floor(Math.random() * 100)}`,
          `${firstName}${lastName}`,
          `${lastName}.${firstName}`
        ],

        // Common Instagram username patterns
        instagramVariations: [
          `${firstName}_${lastName}`,
          `${firstName}${lastName}`,
          `${firstName}_${lastName}_official`,
          `real_${firstName}${lastName}`,
          `the.${firstName}.${lastName}`
        ],

        // Common LinkedIn username patterns
        linkedinVariations: [
          `${firstName}-${lastName}`,
          `${firstName}-${lastName}-${Math.floor(Math.random() * 10000)}`,
          `${lastName}-${firstName}`,
          `${firstName[0]}${lastName}`
        ],

        // Common Twitter username patterns
        twitterVariations: [
          `${firstName}${lastName}`,
          `${firstName}_${lastName}`,
          `${firstName}${lastName}${Math.floor(Math.random() * 100)}`,
          `${firstName[0]}${lastName}`,
          `${firstName}${lastName}_real`
        ],

        // Common GitHub username patterns
        githubVariations: [
          `${firstName}${lastName}`,
          `${firstName}-${lastName}`,
          `${lastName}${firstName}`,
          `${firstName}${lastName}dev`
        ],

        // Common Pinterest username patterns
        pinterestVariations: [
          `${firstName}${lastName}`,
          `${firstName}.${lastName}`,
          `${firstName}_${lastName}`,
          `${firstName}${lastName}pins`
        ]
      };

      // Select a random variation for each platform
      const getRandomVariation = (variationArray) => {
        return variationArray[Math.floor(Math.random() * variationArray.length)];
      };

      // Generate the results with realistic variations
      results = {
        facebook: `https://facebook.com/${getRandomVariation(variations.facebookVariations)}`,
        instagram: `https://instagram.com/${getRandomVariation(variations.instagramVariations)}`,
        linkedin: `https://linkedin.com/in/${getRandomVariation(variations.linkedinVariations)}`,
        twitter: `https://twitter.com/${getRandomVariation(variations.twitterVariations)}`,
        github: `https://github.com/${getRandomVariation(variations.githubVariations)}`,
        pinterest: `https://pinterest.com/${getRandomVariation(variations.pinterestVariations)}`
      };
    } else {
      results = await lookupSocialMedia(name, options);
    }

    console.log(`\n===== SEARCH RESULTS =====`);
    console.log(JSON.stringify(results, null, 2));
    console.timeEnd('Search completed in');
    console.log(`===== SEARCH ENDED =====\n`);

    res.json(results);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'An error occurred during lookup' });
  }
});

// Start Server
(async () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`- GET / : Check API status`);
    console.log(`- POST /lookup : Search for social profiles with JSON body:`);
    console.log(`  { "name": "John Doe", "options": {}, "test": false }`);
    console.log(`  Set "test": true to use test mode (returns mock data without making external requests)`);
  });
})();

export default lookupSocialMedia;