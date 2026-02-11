/**
 * Mock data and route helpers for Playwright tests.
 *
 * Strategy: intercept all network requests that leave the browser —
 *   /config.json          → static config
 *   cognito-idp.*         → fake auth tokens
 *   API Gateway routes    → fake REST API responses
 */

export const API_BASE_URL = 'https://fake-api.execute-api.us-east-1.amazonaws.com/dev';

export const CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_testPool',
  clientId: 'testClientId',
  identityPoolId: 'us-east-1:test-identity-pool',
  apiBaseUrl: API_BASE_URL,
};

export const MOVIES = [
  { movie_id: 'id-1', title: 'The Matrix', year: 1999, genre: 'Sci-Fi', rating: 8.7, director: 'Wachowskis', status: 'active', rank: 'a00' },
  { movie_id: 'id-2', title: 'Inception', year: 2010, genre: 'Sci-Fi', rating: 8.8, director: 'Christopher Nolan', status: 'active', rank: 'a01' },
  { movie_id: 'id-3', title: 'Interstellar', year: 2014, genre: 'Sci-Fi', rating: 8.6, director: 'Christopher Nolan', status: 'active', rank: 'a02' },
  { movie_id: 'id-4', title: 'The Godfather', year: 1972, genre: 'Crime', rating: 9.2, director: 'Francis Ford Coppola', status: 'recentlyWatched', rank: 'a00' },
  { movie_id: 'id-5', title: 'Pulp Fiction', year: 1994, genre: 'Crime', rating: 8.9, director: 'Quentin Tarantino', status: 'notInterested', rank: 'a00' },
];

export const CATALOG_MOVIES = [
  { movie_id: 'id-1', title: 'The Matrix', year: 1999, genre: 'Sci-Fi', rating: 8.7, director: 'Wachowskis', importedDate: '2024-01-01T00:00:00Z', importedFrom: 'add' },
  { movie_id: 'id-2', title: 'Inception', year: 2010, genre: 'Sci-Fi', rating: 8.8, director: 'Christopher Nolan', importedDate: '2024-01-01T00:00:00Z', importedFrom: 'add' },
  { movie_id: 'id-3', title: 'Interstellar', year: 2014, genre: 'Sci-Fi', rating: 8.6, director: 'Christopher Nolan', importedDate: '2024-01-01T00:00:00Z', importedFrom: 'add' },
  { movie_id: 'id-4', title: 'The Godfather', year: 1972, genre: 'Crime', rating: 9.2, director: 'Francis Ford Coppola', importedDate: '2024-01-01T00:00:00Z', importedFrom: 'add' },
  { movie_id: 'id-5', title: 'Pulp Fiction', year: 1994, genre: 'Crime', rating: 8.9, director: 'Quentin Tarantino', importedDate: '2024-01-01T00:00:00Z', importedFrom: 'add' },
  { movie_id: 'id-6', title: 'The Dark Knight', year: 2008, genre: 'Action', rating: 9.0, director: 'Christopher Nolan', importedDate: '2024-01-02T00:00:00Z', importedFrom: 'add' },
  { movie_id: 'id-7', title: 'Fight Club', year: 1999, genre: 'Drama', rating: 8.8, director: 'David Fincher', importedDate: '2024-01-02T00:00:00Z', importedFrom: 'add' },
  { movie_id: 'id-8', title: 'Parasite', year: 2019, genre: 'Thriller', rating: 8.5, director: 'Bong Joon-ho', importedDate: '2024-01-02T00:00:00Z', importedFrom: 'add' },
];

export const CATALOG_QUEUED = {
  'id-1': 'active',
  'id-2': 'active',
  'id-3': 'active',
  'id-4': 'recentlyWatched',
  'id-5': 'notInterested',
};

/**
 * Set up all route mocks on a Playwright page.
 * Returns a handle to track API write calls.
 */
export async function setupMocks(page) {
  const writeCalls = [];

  // Mock /config.json
  await page.route('**/config.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CONFIG) })
  );

  // Mock Cognito auth calls (InitiateAuth only — no more Identity Pool needed)
  await page.route('https://cognito-idp.us-east-1.amazonaws.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/x-amz-json-1.1',
      body: JSON.stringify({
        AuthenticationResult: {
          IdToken: 'fake-id-token',
          AccessToken: 'fake-access-token',
          RefreshToken: 'fake-refresh-token',
        },
      }),
    })
  );

  // Mock API Gateway REST endpoints
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const path = url.replace(API_BASE_URL, '');

    // GET /users/{username}/queue → movieq_list
    if (method === 'GET' && /^\/users\/[^/]+\/queue$/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ movies: MOVIES }),
      });
    }

    // POST /users/{username}/queue/batch → movieq_write (batch)
    if (method === 'POST' && /^\/users\/[^/]+\/queue\/batch$/.test(path)) {
      const reqBody = route.request().postData();
      writeCalls.push(reqBody ? JSON.parse(reqBody) : null);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Created 1 movies', movie_ids: ['new-id'] }),
      });
    }

    // POST /users/{username}/queue → movieq_write (single create)
    if (method === 'POST' && /^\/users\/[^/]+\/queue$/.test(path)) {
      const reqBody = route.request().postData();
      writeCalls.push(reqBody ? JSON.parse(reqBody) : null);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Movie created', movie_id: 'new-id' }),
      });
    }

    // PUT /users/{username}/queue/{movie_id} → movieq_write (update)
    if (method === 'PUT' && /^\/users\/[^/]+\/queue\/[^/]+$/.test(path)) {
      const reqBody = route.request().postData();
      writeCalls.push(reqBody ? JSON.parse(reqBody) : null);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Movie updated', movie_id: 'updated-id' }),
      });
    }

    // GET /movies → movieq_catalog
    if (method === 'GET' && path === '/movies') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ movies: CATALOG_MOVIES, queued: CATALOG_QUEUED }),
      });
    }

    // POST /movies/omdb_lookup → movieq_refresh
    if (method === 'POST' && path === '/movies/omdb_lookup') {
      const refreshMovies = [
        { imdb_id: 'tt0133093', title: 'The Matrix', year: 1999, genre: 'Sci-Fi', rating: 8.7, director: 'Wachowskis' },
        { imdb_id: 'tt0111161', title: 'The Shawshank Redemption', year: 1994, genre: 'Drama', rating: 9.3, director: 'Frank Darabont' },
        { imdb_id: 'tt0068646', title: 'The Godfather Part II', year: 1974, genre: 'Crime', rating: 9.0, director: 'Francis Ford Coppola' },
      ];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ movies: refreshMovies, errors: [] }),
      });
    }

    return route.fulfill({ status: 200, body: '{}' });
  });

  return { writeCalls };
}

/**
 * Log in via the UI — fills username/password and clicks Sign in.
 */
export async function loginViaUI(page) {
  await page.fill('input[placeholder="Username"]', 'testuser');
  await page.fill('input[placeholder="Password"]', 'TestPass123!');
  await page.click('button:has-text("Sign in")');
  // Wait for movie list to appear
  await page.waitForSelector('text=The Matrix', { timeout: 10000 });
}
