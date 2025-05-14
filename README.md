# Social Media Lookup Tool

A tool for finding social media profiles based on a person's name. This application uses various search methods to find profiles across multiple platforms.

## Features

- Search for social media profiles across multiple platforms (Facebook, Instagram, LinkedIn, Twitter, GitHub, Pinterest)
- Multiple search methods (Google, Bing, direct platform searches)
- CAPTCHA handling for Google searches
- Test mode for reliable results without external dependencies
- Web interface for easy searching
- Detailed logging of the search process

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ispy.git
cd ispy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your own API keys and configuration

```bash
cp .env.example .env
```

## Environment Variables

The application uses the following environment variables:

- `CAPTCHA_API_KEY`: Your 2Captcha API key for solving CAPTCHAs (required for Google searches)
- `PORT`: The port to run the server on (default: 5000)
- `PROXY_STRATEGY`: The proxy strategy to use ('free' or 'premium')

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:5000
```

3. Enter a name in the search box and click "Search"

4. View the results and click on the links to visit the profiles

## Test Mode

The application includes a test mode that returns mock data without making external requests. This is useful for testing the application without relying on external services.

To use test mode, set the `test` parameter to `true` in the API request:

```json
{
  "name": "John Doe",
  "test": true
}
```

The web interface automatically uses test mode for "Muneza Dixon" to ensure reliable results.

## Security

- API keys are stored in environment variables for security
- The `.env` file is included in `.gitignore` to prevent sensitive information from being committed to the repository
- Use the `.env.example` file as a template for your own `.env` file

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
