import json
import os
import urllib.request
import urllib.error
from decimal import Decimal

OMDB_API_KEY = os.environ["OMDB_API_KEY"]


def _fetch_omdb(imdb_id):
    """Fetch movie data from OMDb API by IMDb ID."""
    url = f"http://www.omdbapi.com/?i={imdb_id}&apikey={OMDB_API_KEY}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def _parse_year(year_str):
    """Parse year string from OMDb (may contain ranges like '2019-2023')."""
    try:
        return int(year_str[:4])
    except (ValueError, TypeError):
        return 0


def _parse_rating(rating_str):
    """Parse imdbRating string to float."""
    try:
        return float(rating_str)
    except (ValueError, TypeError):
        return 0


class _DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body) if not isinstance(body, str) else body,
    }


def lambda_handler(event, context):
    raw_body = event.get("body")
    body = json.loads(raw_body) if isinstance(raw_body, str) else (raw_body or event)
    imdb_ids = body.get("imdb_ids", [])

    if not imdb_ids:
        return _response(400, {"error": "imdb_ids list is required"})

    movies = []
    errors = []

    for imdb_id in imdb_ids:
        try:
            omdb_data = _fetch_omdb(imdb_id)

            if omdb_data.get("Response") == "False":
                errors.append({"imdb_id": imdb_id, "error": omdb_data.get("Error", "Not found")})
                continue

            title = omdb_data.get("Title", "")
            year = _parse_year(omdb_data.get("Year", "0"))
            genre_raw = omdb_data.get("Genre", "")
            first_genre = genre_raw.split(",")[0].strip() if genre_raw else ""
            rating = _parse_rating(omdb_data.get("imdbRating", "0"))
            director = omdb_data.get("Director", "")

            movies.append({
                "imdb_id": imdb_id,
                "title": title,
                "year": year,
                "genre": first_genre,
                "rating": rating,
                "director": director,
            })

        except (urllib.error.URLError, json.JSONDecodeError) as e:
            errors.append({"imdb_id": imdb_id, "error": str(e)})

    return _response(200, json.dumps({"movies": movies, "errors": errors}, cls=_DecimalEncoder))
