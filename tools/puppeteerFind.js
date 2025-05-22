import puppeteer from 'puppeteer';

async function puppeteerFind({ selector, shadowRoot = false, attributes = [] }) {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto('https://your.salesforce.url', { waitUntil: 'networkidle2' });

    // Your logic here

// Shadow DOM-aware query
const elementHandle = shadowRoot
  ? await page.evaluateHandle((sel) => {
      const deepQuery = (root) => {
        if (!root.shadowRoot) return root.querySelector(sel);
        return deepQuery(root.shadowRoot) || root.querySelector(sel);
      };
      return deepQuery(document);
    }, selector)
  : await page.$(selector);

if (!elementHandle) throw new Error(`Element not found: ${selector}`);

const result = await page.evaluate((el, attrs) => {
  const res = {};
  attrs.forEach(attr => res[attr] = el[attr] || el.getAttribute(attr));
  return res;
}, elementHandle, attributes);

console.log('Attributes found:', result);


    await browser.close();

    return {
      content: [{
        type: 'text',
        text: `✅ puppeteerFind executed successfully`
      }]
    };
  } catch (error) {
    console.error(`Error in puppeteerFind:`, error);
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `❌ Error: ${error.message}`
      }]
    };
  }
}

export {puppeteerFind};