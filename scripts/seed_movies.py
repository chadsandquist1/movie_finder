#!/usr/bin/env python3
"""Seed the DynamoDB movies and queue tables with 366 movies.

Usage:
    python scripts/seed_movies.py                          # uses default table names
    python scripts/seed_movies.py --table my-table-name    # explicit movies table name
    python scripts/seed_movies.py --queue-table my-queue   # explicit queue table name
    python scripts/seed_movies.py --username chad          # queue owner (default: chad)
    python scripts/seed_movies.py --region us-west-2       # explicit region
"""

import argparse
import json
import random
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3

# ---------------------------------------------------------------------------
# 366 movies: (title, year, genre, rating, director)
# ---------------------------------------------------------------------------
MOVIES = [
    # 2020s
    ("Sinners", 2025, "Horror", 7.8, "Ryan Coogler"),
    ("Thunderbolts*", 2025, "Action", 7.2, "Jake Schreier"),
    ("Mission: Impossible - The Final Reckoning", 2025, "Action", 8.1, "Christopher McQuarrie"),
    ("The Amateur", 2025, "Thriller", 6.9, "James Hawes"),
    ("Ballerina", 2025, "Action", 7.0, "Len Wiseman"),
    ("Elio", 2025, "Animation", 7.5, "Adrian Molina"),
    ("The Fantastic Four: First Steps", 2025, "Sci-Fi", 7.3, "Matt Shakman"),
    ("Superman", 2025, "Action", 8.0, "James Gunn"),
    ("Lilo & Stitch", 2025, "Family", 7.4, "Dean Fleischer Camp"),
    ("How to Train Your Dragon", 2025, "Fantasy", 7.6, "Dean DeBlois"),
    ("Oppenheimer", 2023, "Drama", 8.5, "Christopher Nolan"),
    ("Barbie", 2023, "Comedy", 7.0, "Greta Gerwig"),
    ("Killers of the Flower Moon", 2023, "Drama", 7.7, "Martin Scorsese"),
    ("Poor Things", 2023, "Comedy", 8.0, "Yorgos Lanthimos"),
    ("The Holdovers", 2023, "Comedy", 7.9, "Alexander Payne"),
    ("Past Lives", 2023, "Romance", 7.8, "Celine Song"),
    ("Anatomy of a Fall", 2023, "Thriller", 7.7, "Justine Triet"),
    ("The Zone of Interest", 2023, "Drama", 7.4, "Jonathan Glazer"),
    ("American Fiction", 2023, "Comedy", 7.6, "Cord Jefferson"),
    ("Maestro", 2023, "Drama", 6.7, "Bradley Cooper"),
    ("Spider-Man: Across the Spider-Verse", 2023, "Animation", 8.7, "Joaquim Dos Santos"),
    ("Guardians of the Galaxy Vol. 3", 2023, "Action", 7.9, "James Gunn"),
    ("John Wick: Chapter 4", 2023, "Action", 7.7, "Chad Stahelski"),
    ("The Killer", 2023, "Thriller", 6.8, "David Fincher"),
    ("Napoleon", 2023, "Drama", 6.5, "Ridley Scott"),
    ("Wonka", 2023, "Family", 7.1, "Paul King"),
    ("Saltburn", 2023, "Thriller", 7.0, "Emerald Fennell"),
    ("May December", 2023, "Drama", 6.9, "Todd Haynes"),
    ("The Iron Claw", 2023, "Drama", 7.6, "Sean Durkin"),
    ("Priscilla", 2023, "Drama", 6.4, "Sofia Coppola"),
    ("Everything Everywhere All at Once", 2022, "Sci-Fi", 8.0, "Daniel Kwan"),
    ("Top Gun: Maverick", 2022, "Action", 8.3, "Joseph Kosinski"),
    ("The Banshees of Inisherin", 2022, "Drama", 7.7, "Martin McDonagh"),
    ("Tar", 2022, "Drama", 7.5, "Todd Field"),
    ("The Whale", 2022, "Drama", 7.7, "Darren Aronofsky"),
    ("Triangle of Sadness", 2022, "Comedy", 7.3, "Ruben Ostlund"),
    ("All Quiet on the Western Front", 2022, "War", 7.8, "Edward Berger"),
    ("Glass Onion", 2022, "Mystery", 7.1, "Rian Johnson"),
    ("Avatar: The Way of Water", 2022, "Sci-Fi", 7.6, "James Cameron"),
    ("Black Panther: Wakanda Forever", 2022, "Action", 6.7, "Ryan Coogler"),
    ("Elvis", 2022, "Drama", 7.4, "Baz Luhrmann"),
    ("Nope", 2022, "Horror", 6.8, "Jordan Peele"),
    ("The Batman", 2022, "Action", 7.8, "Matt Reeves"),
    ("Aftersun", 2022, "Drama", 7.7, "Charlotte Wells"),
    ("Decision to Leave", 2022, "Thriller", 7.4, "Park Chan-wook"),
    ("RRR", 2022, "Action", 7.8, "S.S. Rajamouli"),
    ("Marcel the Shell with Shoes On", 2022, "Animation", 7.7, "Dean Fleischer Camp"),
    ("The Fabelmans", 2022, "Drama", 7.5, "Steven Spielberg"),
    ("Women Talking", 2022, "Drama", 6.8, "Sarah Polley"),
    ("Babylon", 2022, "Drama", 7.1, "Damien Chazelle"),
    ("Dune", 2021, "Sci-Fi", 8.0, "Denis Villeneuve"),
    ("The Power of the Dog", 2021, "Drama", 6.9, "Jane Campion"),
    ("Belfast", 2021, "Drama", 7.0, "Kenneth Branagh"),
    ("Licorice Pizza", 2021, "Comedy", 7.4, "Paul Thomas Anderson"),
    ("West Side Story", 2021, "Musical", 7.3, "Steven Spielberg"),
    ("King Richard", 2021, "Drama", 7.5, "Reinaldo Marcus Green"),
    ("CODA", 2021, "Drama", 8.0, "Sian Heder"),
    ("Don't Look Up", 2021, "Comedy", 7.2, "Adam McKay"),
    ("The French Dispatch", 2021, "Comedy", 7.1, "Wes Anderson"),
    ("Nightmare Alley", 2021, "Thriller", 7.0, "Guillermo del Toro"),
    ("No Time to Die", 2021, "Action", 6.8, "Cary Joji Fukunaga"),
    ("The Last Duel", 2021, "Drama", 7.4, "Ridley Scott"),
    ("Shang-Chi and the Legend of the Ten Rings", 2021, "Action", 7.4, "Destin Daniel Cretton"),
    ("Spencer", 2021, "Drama", 6.6, "Pablo Larrain"),
    ("Drive My Car", 2021, "Drama", 7.6, "Ryusuke Hamaguchi"),
    ("The Worst Person in the World", 2021, "Romance", 7.7, "Joachim Trier"),
    ("Tick, Tick... Boom!", 2021, "Musical", 7.5, "Lin-Manuel Miranda"),
    ("Flee", 2021, "Animation", 7.9, "Jonas Poher Rasmussen"),
    ("C'mon C'mon", 2021, "Drama", 7.4, "Mike Mills"),
    ("The Tragedy of Macbeth", 2021, "Drama", 7.1, "Joel Coen"),
    ("Nomadland", 2020, "Drama", 7.3, "Chloe Zhao"),
    ("The Father", 2020, "Drama", 8.2, "Florian Zeller"),
    ("Promising Young Woman", 2020, "Thriller", 7.5, "Emerald Fennell"),
    ("Minari", 2020, "Drama", 7.5, "Lee Isaac Chung"),
    ("Sound of Metal", 2020, "Drama", 7.8, "Darius Marder"),
    ("Judas and the Black Messiah", 2020, "Drama", 7.5, "Shaka King"),
    ("Another Round", 2020, "Comedy", 7.7, "Thomas Vinterberg"),
    ("Soul", 2020, "Animation", 8.0, "Pete Docter"),
    ("Mank", 2020, "Drama", 6.8, "David Fincher"),
    ("The Trial of the Chicago 7", 2020, "Drama", 7.8, "Aaron Sorkin"),
    # 2010s
    ("Parasite", 2019, "Thriller", 8.5, "Bong Joon-ho"),
    ("1917", 2019, "War", 8.3, "Sam Mendes"),
    ("Joker", 2019, "Drama", 8.4, "Todd Phillips"),
    ("Once Upon a Time in Hollywood", 2019, "Comedy", 7.6, "Quentin Tarantino"),
    ("Marriage Story", 2019, "Drama", 7.9, "Noah Baumbach"),
    ("The Irishman", 2019, "Drama", 7.8, "Martin Scorsese"),
    ("Jojo Rabbit", 2019, "Comedy", 7.9, "Taika Waititi"),
    ("Little Women", 2019, "Drama", 7.8, "Greta Gerwig"),
    ("Ford v Ferrari", 2019, "Drama", 8.1, "James Mangold"),
    ("Knives Out", 2019, "Mystery", 7.9, "Rian Johnson"),
    ("Uncut Gems", 2019, "Thriller", 7.4, "Josh Safdie"),
    ("The Lighthouse", 2019, "Horror", 7.5, "Robert Eggers"),
    ("Midsommar", 2019, "Horror", 7.1, "Ari Aster"),
    ("Avengers: Endgame", 2019, "Action", 8.4, "Anthony Russo"),
    ("Toy Story 4", 2019, "Animation", 7.7, "Josh Cooley"),
    ("Booksmart", 2019, "Comedy", 7.1, "Olivia Wilde"),
    ("Us", 2019, "Horror", 6.8, "Jordan Peele"),
    ("The Farewell", 2019, "Drama", 7.6, "Lulu Wang"),
    ("Pain and Glory", 2019, "Drama", 7.5, "Pedro Almodovar"),
    ("Portrait of a Lady on Fire", 2019, "Romance", 8.1, "Celine Sciamma"),
    ("Roma", 2018, "Drama", 7.7, "Alfonso Cuaron"),
    ("Green Book", 2018, "Drama", 8.2, "Peter Farrelly"),
    ("A Star Is Born", 2018, "Romance", 7.6, "Bradley Cooper"),
    ("BlacKkKlansman", 2018, "Drama", 7.5, "Spike Lee"),
    ("Bohemian Rhapsody", 2018, "Drama", 7.9, "Bryan Singer"),
    ("The Favourite", 2018, "Comedy", 7.5, "Yorgos Lanthimos"),
    ("Vice", 2018, "Drama", 7.2, "Adam McKay"),
    ("Black Panther", 2018, "Action", 7.3, "Ryan Coogler"),
    ("Spider-Man: Into the Spider-Verse", 2018, "Animation", 8.4, "Bob Persichetti"),
    ("Hereditary", 2018, "Horror", 7.3, "Ari Aster"),
    ("A Quiet Place", 2018, "Horror", 7.5, "John Krasinski"),
    ("Eighth Grade", 2018, "Comedy", 7.4, "Bo Burnham"),
    ("Mission: Impossible - Fallout", 2018, "Action", 7.7, "Christopher McQuarrie"),
    ("Avengers: Infinity War", 2018, "Action", 8.4, "Anthony Russo"),
    ("Isle of Dogs", 2018, "Animation", 7.9, "Wes Anderson"),
    ("Sorry to Bother You", 2018, "Comedy", 6.9, "Boots Riley"),
    ("First Reformed", 2018, "Drama", 7.1, "Paul Schrader"),
    ("Shoplifters", 2018, "Drama", 7.9, "Hirokazu Kore-eda"),
    ("The Shape of Water", 2017, "Fantasy", 7.3, "Guillermo del Toro"),
    ("Three Billboards Outside Ebbing, Missouri", 2017, "Drama", 8.1, "Martin McDonagh"),
    ("Get Out", 2017, "Horror", 7.7, "Jordan Peele"),
    ("Lady Bird", 2017, "Comedy", 7.4, "Greta Gerwig"),
    ("Phantom Thread", 2017, "Drama", 7.5, "Paul Thomas Anderson"),
    ("Dunkirk", 2017, "War", 7.8, "Christopher Nolan"),
    ("Call Me by Your Name", 2017, "Romance", 7.9, "Luca Guadagnino"),
    ("The Post", 2017, "Drama", 7.2, "Steven Spielberg"),
    ("Coco", 2017, "Animation", 8.4, "Lee Unkrich"),
    ("Logan", 2017, "Action", 8.1, "James Mangold"),
    ("Baby Driver", 2017, "Action", 7.6, "Edgar Wright"),
    ("Blade Runner 2049", 2017, "Sci-Fi", 8.0, "Denis Villeneuve"),
    ("The Disaster Artist", 2017, "Comedy", 7.4, "James Franco"),
    ("The Florida Project", 2017, "Drama", 7.6, "Sean Baker"),
    ("I, Tonya", 2017, "Drama", 7.5, "Craig Gillespie"),
    ("Thor: Ragnarok", 2017, "Action", 7.9, "Taika Waititi"),
    ("The Big Sick", 2017, "Comedy", 7.5, "Michael Showalter"),
    ("Good Time", 2017, "Thriller", 7.4, "Josh Safdie"),
    ("Moonlight", 2016, "Drama", 7.4, "Barry Jenkins"),
    ("La La Land", 2016, "Musical", 8.0, "Damien Chazelle"),
    ("Manchester by the Sea", 2016, "Drama", 7.8, "Kenneth Lonergan"),
    ("Arrival", 2016, "Sci-Fi", 7.9, "Denis Villeneuve"),
    ("Hell or High Water", 2016, "Thriller", 7.6, "David Mackenzie"),
    ("Fences", 2016, "Drama", 7.2, "Denzel Washington"),
    ("Lion", 2016, "Drama", 8.0, "Garth Davis"),
    ("Hacksaw Ridge", 2016, "War", 8.1, "Mel Gibson"),
    ("Hidden Figures", 2016, "Drama", 7.8, "Theodore Melfi"),
    ("Moana", 2016, "Animation", 7.6, "Ron Clements"),
    ("Deadpool", 2016, "Action", 8.0, "Tim Miller"),
    ("Zootopia", 2016, "Animation", 8.0, "Byron Howard"),
    ("The Handmaiden", 2016, "Thriller", 8.1, "Park Chan-wook"),
    ("Captain America: Civil War", 2016, "Action", 7.8, "Anthony Russo"),
    ("Rogue One", 2016, "Sci-Fi", 7.8, "Gareth Edwards"),
    ("The Witch", 2015, "Horror", 6.9, "Robert Eggers"),
    ("Room", 2015, "Drama", 8.1, "Lenny Abrahamson"),
    ("Spotlight", 2015, "Drama", 8.1, "Tom McCarthy"),
    ("The Revenant", 2015, "Adventure", 8.0, "Alejandro Gonzalez Inarritu"),
    ("The Big Short", 2015, "Drama", 7.8, "Adam McKay"),
    ("Mad Max: Fury Road", 2015, "Action", 8.1, "George Miller"),
    ("The Martian", 2015, "Sci-Fi", 8.0, "Ridley Scott"),
    ("Brooklyn", 2015, "Romance", 7.5, "John Crowley"),
    ("Ex Machina", 2015, "Sci-Fi", 7.7, "Alex Garland"),
    ("Inside Out", 2015, "Animation", 8.1, "Pete Docter"),
    ("Star Wars: The Force Awakens", 2015, "Sci-Fi", 7.9, "J.J. Abrams"),
    ("Sicario", 2015, "Thriller", 7.6, "Denis Villeneuve"),
    ("Carol", 2015, "Romance", 7.2, "Todd Haynes"),
    ("The Hateful Eight", 2015, "Western", 7.8, "Quentin Tarantino"),
    ("Creed", 2015, "Drama", 7.6, "Ryan Coogler"),
    ("The Lobster", 2015, "Comedy", 7.1, "Yorgos Lanthimos"),
    ("Birdman", 2014, "Comedy", 7.7, "Alejandro Gonzalez Inarritu"),
    ("Boyhood", 2014, "Drama", 7.9, "Richard Linklater"),
    ("Whiplash", 2014, "Drama", 8.5, "Damien Chazelle"),
    ("The Grand Budapest Hotel", 2014, "Comedy", 8.1, "Wes Anderson"),
    ("The Imitation Game", 2014, "Drama", 8.0, "Morten Tyldum"),
    ("Selma", 2014, "Drama", 7.5, "Ava DuVernay"),
    ("Interstellar", 2014, "Sci-Fi", 8.7, "Christopher Nolan"),
    ("Gone Girl", 2014, "Thriller", 8.1, "David Fincher"),
    ("Nightcrawler", 2014, "Thriller", 7.9, "Dan Gilroy"),
    ("The Lego Movie", 2014, "Animation", 7.7, "Phil Lord"),
    ("Guardians of the Galaxy", 2014, "Action", 8.0, "James Gunn"),
    ("John Wick", 2014, "Action", 7.4, "Chad Stahelski"),
    ("Foxcatcher", 2014, "Drama", 7.0, "Bennett Miller"),
    ("Under the Skin", 2013, "Sci-Fi", 6.3, "Jonathan Glazer"),
    ("12 Years a Slave", 2013, "Drama", 8.1, "Steve McQueen"),
    ("Gravity", 2013, "Sci-Fi", 7.7, "Alfonso Cuaron"),
    ("Her", 2013, "Romance", 8.0, "Spike Jonze"),
    ("The Wolf of Wall Street", 2013, "Comedy", 8.2, "Martin Scorsese"),
    ("Dallas Buyers Club", 2013, "Drama", 8.0, "Jean-Marc Vallee"),
    ("Nebraska", 2013, "Drama", 7.7, "Alexander Payne"),
    ("Blue Jasmine", 2013, "Drama", 7.3, "Woody Allen"),
    ("Frozen", 2013, "Animation", 7.4, "Chris Buck"),
    ("The Great Gatsby", 2013, "Drama", 7.2, "Baz Luhrmann"),
    ("Captain Phillips", 2013, "Thriller", 7.8, "Paul Greengrass"),
    ("Inside Llewyn Davis", 2013, "Drama", 7.4, "Joel Coen"),
    ("Rush", 2013, "Drama", 8.1, "Ron Howard"),
    ("Prisoners", 2013, "Thriller", 8.1, "Denis Villeneuve"),
    ("Short Term 12", 2013, "Drama", 8.0, "Destin Daniel Cretton"),
    ("Argo", 2012, "Thriller", 7.7, "Ben Affleck"),
    ("Django Unchained", 2012, "Western", 8.4, "Quentin Tarantino"),
    ("Life of Pi", 2012, "Adventure", 7.9, "Ang Lee"),
    ("Les Miserables", 2012, "Musical", 7.5, "Tom Hooper"),
    ("Silver Linings Playbook", 2012, "Comedy", 7.7, "David O. Russell"),
    ("Lincoln", 2012, "Drama", 7.3, "Steven Spielberg"),
    ("Skyfall", 2012, "Action", 7.7, "Sam Mendes"),
    ("Moonrise Kingdom", 2012, "Comedy", 7.8, "Wes Anderson"),
    ("The Avengers", 2012, "Action", 8.0, "Joss Whedon"),
    ("The Dark Knight Rises", 2012, "Action", 8.4, "Christopher Nolan"),
    ("Beasts of the Southern Wild", 2012, "Drama", 7.3, "Benh Zeitlin"),
    ("Amour", 2012, "Drama", 7.6, "Michael Haneke"),
    ("Looper", 2012, "Sci-Fi", 7.4, "Rian Johnson"),
    ("The Artist", 2011, "Comedy", 7.9, "Michel Hazanavicius"),
    ("The Descendants", 2011, "Drama", 7.3, "Alexander Payne"),
    ("Hugo", 2011, "Family", 7.5, "Martin Scorsese"),
    ("Midnight in Paris", 2011, "Comedy", 7.7, "Woody Allen"),
    ("The Tree of Life", 2011, "Drama", 6.8, "Terrence Malick"),
    ("Drive", 2011, "Thriller", 7.8, "Nicolas Winding Refn"),
    ("A Separation", 2011, "Drama", 8.3, "Asghar Farhadi"),
    ("Moneyball", 2011, "Drama", 7.6, "Bennett Miller"),
    ("The Help", 2011, "Drama", 8.0, "Tate Taylor"),
    ("Bridesmaids", 2011, "Comedy", 6.8, "Paul Feig"),
    # 2000s
    ("The King's Speech", 2010, "Drama", 8.0, "Tom Hooper"),
    ("Black Swan", 2010, "Thriller", 8.0, "Darren Aronofsky"),
    ("The Social Network", 2010, "Drama", 7.8, "David Fincher"),
    ("Inception", 2010, "Sci-Fi", 8.8, "Christopher Nolan"),
    ("True Grit", 2010, "Western", 7.6, "Joel Coen"),
    ("The Fighter", 2010, "Drama", 7.8, "David O. Russell"),
    ("127 Hours", 2010, "Drama", 7.5, "Danny Boyle"),
    ("Toy Story 3", 2010, "Animation", 8.3, "Lee Unkrich"),
    ("Shutter Island", 2010, "Thriller", 8.2, "Martin Scorsese"),
    ("The Hurt Locker", 2009, "War", 7.5, "Kathryn Bigelow"),
    ("Inglourious Basterds", 2009, "War", 8.3, "Quentin Tarantino"),
    ("Up", 2009, "Animation", 8.3, "Pete Docter"),
    ("Avatar", 2009, "Sci-Fi", 7.9, "James Cameron"),
    ("District 9", 2009, "Sci-Fi", 7.9, "Neill Blomkamp"),
    ("A Serious Man", 2009, "Comedy", 7.0, "Joel Coen"),
    ("An Education", 2009, "Drama", 7.3, "Lone Scherfig"),
    ("Fantastic Mr. Fox", 2009, "Animation", 7.9, "Wes Anderson"),
    ("Star Trek", 2009, "Sci-Fi", 7.9, "J.J. Abrams"),
    ("Slumdog Millionaire", 2008, "Drama", 8.0, "Danny Boyle"),
    ("The Dark Knight", 2008, "Action", 9.0, "Christopher Nolan"),
    ("Wall-E", 2008, "Animation", 8.4, "Andrew Stanton"),
    ("Milk", 2008, "Drama", 7.5, "Gus Van Sant"),
    ("The Curious Case of Benjamin Button", 2008, "Fantasy", 7.8, "David Fincher"),
    ("The Wrestler", 2008, "Drama", 7.9, "Darren Aronofsky"),
    ("Frost/Nixon", 2008, "Drama", 7.7, "Ron Howard"),
    ("In Bruges", 2008, "Comedy", 7.9, "Martin McDonagh"),
    ("Iron Man", 2008, "Action", 7.9, "Jon Favreau"),
    ("No Country for Old Men", 2007, "Thriller", 8.2, "Joel Coen"),
    ("There Will Be Blood", 2007, "Drama", 8.2, "Paul Thomas Anderson"),
    ("Juno", 2007, "Comedy", 7.4, "Jason Reitman"),
    ("Michael Clayton", 2007, "Thriller", 7.2, "Tony Gilroy"),
    ("Atonement", 2007, "Romance", 7.8, "Joe Wright"),
    ("Ratatouille", 2007, "Animation", 8.1, "Brad Bird"),
    ("The Bourne Ultimatum", 2007, "Action", 8.0, "Paul Greengrass"),
    ("Zodiac", 2007, "Thriller", 7.7, "David Fincher"),
    ("Superbad", 2007, "Comedy", 7.6, "Greg Mottola"),
    ("Into the Wild", 2007, "Adventure", 8.1, "Sean Penn"),
    ("The Departed", 2006, "Thriller", 8.5, "Martin Scorsese"),
    ("Little Miss Sunshine", 2006, "Comedy", 7.8, "Jonathan Dayton"),
    ("The Queen", 2006, "Drama", 7.3, "Stephen Frears"),
    ("Pan's Labyrinth", 2006, "Fantasy", 8.2, "Guillermo del Toro"),
    ("Blood Diamond", 2006, "Thriller", 8.0, "Edward Zwick"),
    ("Children of Men", 2006, "Sci-Fi", 7.9, "Alfonso Cuaron"),
    ("The Prestige", 2006, "Thriller", 8.5, "Christopher Nolan"),
    ("Casino Royale", 2006, "Action", 8.0, "Martin Campbell"),
    ("Babel", 2006, "Drama", 7.4, "Alejandro Gonzalez Inarritu"),
    ("Brokeback Mountain", 2005, "Romance", 7.7, "Ang Lee"),
    ("Crash", 2004, "Drama", 7.7, "Paul Haggis"),
    ("Million Dollar Baby", 2004, "Drama", 8.1, "Clint Eastwood"),
    ("Sideways", 2004, "Comedy", 7.5, "Alexander Payne"),
    ("Eternal Sunshine of the Spotless Mind", 2004, "Romance", 8.3, "Michel Gondry"),
    ("The Incredibles", 2004, "Animation", 8.0, "Brad Bird"),
    ("Hotel Rwanda", 2004, "Drama", 8.1, "Terry George"),
    ("Kill Bill: Vol. 2", 2004, "Action", 8.0, "Quentin Tarantino"),
    ("Shaun of the Dead", 2004, "Comedy", 7.9, "Edgar Wright"),
    ("The Lord of the Rings: The Return of the King", 2003, "Fantasy", 9.0, "Peter Jackson"),
    ("Lost in Translation", 2003, "Comedy", 7.7, "Sofia Coppola"),
    ("Finding Nemo", 2003, "Animation", 8.2, "Andrew Stanton"),
    ("Mystic River", 2003, "Thriller", 7.9, "Clint Eastwood"),
    ("Kill Bill: Vol. 1", 2003, "Action", 8.2, "Quentin Tarantino"),
    ("Master and Commander", 2003, "Adventure", 7.4, "Peter Weir"),
    ("21 Grams", 2003, "Drama", 7.6, "Alejandro Gonzalez Inarritu"),
    ("Old Boy", 2003, "Thriller", 8.4, "Park Chan-wook"),
    ("Pirates of the Caribbean: The Curse of the Black Pearl", 2003, "Adventure", 8.1, "Gore Verbinski"),
    ("Chicago", 2002, "Musical", 7.2, "Rob Marshall"),
    ("The Pianist", 2002, "Drama", 8.5, "Roman Polanski"),
    ("Gangs of New York", 2002, "Drama", 7.5, "Martin Scorsese"),
    ("The Lord of the Rings: The Two Towers", 2002, "Fantasy", 8.8, "Peter Jackson"),
    ("City of God", 2002, "Drama", 8.6, "Fernando Meirelles"),
    ("Catch Me If You Can", 2002, "Drama", 8.1, "Steven Spielberg"),
    ("Spirited Away", 2001, "Animation", 8.6, "Hayao Miyazaki"),
    ("A Beautiful Mind", 2001, "Drama", 8.2, "Ron Howard"),
    ("The Lord of the Rings: The Fellowship of the Ring", 2001, "Fantasy", 8.8, "Peter Jackson"),
    ("Moulin Rouge!", 2001, "Musical", 7.6, "Baz Luhrmann"),
    ("Amelie", 2001, "Romance", 8.3, "Jean-Pierre Jeunet"),
    ("Training Day", 2001, "Thriller", 7.7, "Antoine Fuqua"),
    ("Monsters, Inc.", 2001, "Animation", 8.1, "Pete Docter"),
    ("Shrek", 2001, "Animation", 7.9, "Andrew Adamson"),
    ("Gladiator", 2000, "Action", 8.5, "Ridley Scott"),
    ("Traffic", 2000, "Thriller", 7.6, "Steven Soderbergh"),
    ("Crouching Tiger, Hidden Dragon", 2000, "Action", 7.9, "Ang Lee"),
    ("Requiem for a Dream", 2000, "Drama", 8.3, "Darren Aronofsky"),
    ("Memento", 2000, "Thriller", 8.4, "Christopher Nolan"),
    ("Almost Famous", 2000, "Comedy", 7.9, "Cameron Crowe"),
    ("Cast Away", 2000, "Adventure", 7.8, "Robert Zemeckis"),
    # Pre-2000 classics
    ("The Matrix", 1999, "Sci-Fi", 8.7, "Lana Wachowski"),
    ("American Beauty", 1999, "Drama", 8.3, "Sam Mendes"),
    ("Fight Club", 1999, "Drama", 8.8, "David Fincher"),
    ("The Sixth Sense", 1999, "Thriller", 8.1, "M. Night Shyamalan"),
    ("The Green Mile", 1999, "Drama", 8.6, "Frank Darabont"),
    ("Magnolia", 1999, "Drama", 8.0, "Paul Thomas Anderson"),
    ("The Talented Mr. Ripley", 1999, "Thriller", 7.4, "Anthony Minghella"),
    ("Saving Private Ryan", 1998, "War", 8.6, "Steven Spielberg"),
    ("The Truman Show", 1998, "Drama", 8.2, "Peter Weir"),
    ("Shakespeare in Love", 1998, "Romance", 7.1, "John Madden"),
    ("The Big Lebowski", 1998, "Comedy", 8.1, "Joel Coen"),
    ("Titanic", 1997, "Romance", 7.9, "James Cameron"),
    ("Good Will Hunting", 1997, "Drama", 8.3, "Gus Van Sant"),
    ("L.A. Confidential", 1997, "Thriller", 8.2, "Curtis Hanson"),
    ("Fargo", 1996, "Thriller", 8.1, "Joel Coen"),
    ("The English Patient", 1996, "Romance", 7.4, "Anthony Minghella"),
    ("Trainspotting", 1996, "Drama", 8.1, "Danny Boyle"),
    ("Braveheart", 1995, "Action", 8.3, "Mel Gibson"),
    ("Se7en", 1995, "Thriller", 8.6, "David Fincher"),
    ("The Usual Suspects", 1995, "Thriller", 8.5, "Bryan Singer"),
    ("Forrest Gump", 1994, "Drama", 8.8, "Robert Zemeckis"),
    ("Pulp Fiction", 1994, "Drama", 8.9, "Quentin Tarantino"),
    ("The Shawshank Redemption", 1994, "Drama", 9.3, "Frank Darabont"),
    ("The Lion King", 1994, "Animation", 8.5, "Roger Allers"),
    ("Schindler's List", 1993, "Drama", 9.0, "Steven Spielberg"),
    ("Jurassic Park", 1993, "Sci-Fi", 8.2, "Steven Spielberg"),
    ("Groundhog Day", 1993, "Comedy", 8.0, "Harold Ramis"),
    ("Unforgiven", 1992, "Western", 8.2, "Clint Eastwood"),
    ("The Silence of the Lambs", 1991, "Thriller", 8.6, "Jonathan Demme"),
    ("Goodfellas", 1990, "Drama", 8.7, "Martin Scorsese"),
    ("Edward Scissorhands", 1990, "Fantasy", 7.9, "Tim Burton"),
    ("The Godfather", 1972, "Drama", 9.2, "Francis Ford Coppola"),
    ("The Godfather Part II", 1974, "Drama", 9.0, "Francis Ford Coppola"),
    ("Jaws", 1975, "Thriller", 8.1, "Steven Spielberg"),
    ("Rocky", 1976, "Drama", 8.1, "John G. Avildsen"),
    ("Star Wars: A New Hope", 1977, "Sci-Fi", 8.6, "George Lucas"),
    ("Alien", 1979, "Sci-Fi", 8.5, "Ridley Scott"),
    ("Apocalypse Now", 1979, "War", 8.4, "Francis Ford Coppola"),
    ("Raiders of the Lost Ark", 1981, "Adventure", 8.4, "Steven Spielberg"),
    ("E.T. the Extra-Terrestrial", 1982, "Sci-Fi", 7.9, "Steven Spielberg"),
    ("Blade Runner", 1982, "Sci-Fi", 8.1, "Ridley Scott"),
    ("The Shining", 1980, "Horror", 8.4, "Stanley Kubrick"),
    ("Back to the Future", 1985, "Sci-Fi", 8.5, "Robert Zemeckis"),
    ("The Breakfast Club", 1985, "Comedy", 7.8, "John Hughes"),
    ("The Princess Bride", 1987, "Fantasy", 8.0, "Rob Reiner"),
    ("Die Hard", 1988, "Action", 8.2, "John McTiernan"),
    ("Rain Man", 1988, "Drama", 8.0, "Barry Levinson"),
    ("Batman", 1989, "Action", 7.5, "Tim Burton"),
    ("When Harry Met Sally", 1989, "Romance", 7.7, "Rob Reiner"),
    ("Do the Right Thing", 1989, "Drama", 8.0, "Spike Lee"),
    ("Dead Poets Society", 1989, "Drama", 8.1, "Peter Weir"),
    ("Cinema Paradiso", 1988, "Drama", 8.5, "Giuseppe Tornatore"),
    ("My Neighbor Totoro", 1988, "Animation", 8.1, "Hayao Miyazaki"),
    ("The Brutalist", 2024, "Drama", 7.8, "Brady Corbet"),
    ("Dune: Part Two", 2024, "Sci-Fi", 8.5, "Denis Villeneuve"),
    ("The Substance", 2024, "Horror", 7.2, "Coralie Fargeat"),
    ("Anora", 2024, "Drama", 7.6, "Sean Baker"),
    ("Conclave", 2024, "Thriller", 7.4, "Edward Berger"),
    ("A Real Pain", 2024, "Comedy", 7.3, "Jesse Eisenberg"),
    ("Wicked", 2024, "Musical", 7.5, "Jon M. Chu"),
    ("Emilia Perez", 2024, "Musical", 6.8, "Jacques Audiard"),
    ("The Wild Robot", 2024, "Animation", 8.2, "Chris Sanders"),
    ("Nosferatu", 2024, "Horror", 7.6, "Robert Eggers"),
]

STATUSES = ["active", "recentlyWatched", "notInterested"]
BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def rank_for_index(i):
    """Generate a lexicographically sortable rank string for index i.

    Uses 'a' prefix + two base-62 digits, giving 3844 possible ranks.
    Compatible with the fractional-indexing library's key space.
    """
    d1 = BASE62[i // 62]
    d2 = BASE62[i % 62]
    return f"a{d1}{d2}"


def get_table_name(output_name):
    """Try to read a table name from terraform output."""
    try:
        result = subprocess.run(
            ["terraform", "output", "-raw", output_name],
            capture_output=True,
            text=True,
            cwd=str(__import__("pathlib").Path(__file__).resolve().parent.parent / "terraform"),
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def main():
    parser = argparse.ArgumentParser(description="Seed DynamoDB movies and queue tables")
    parser.add_argument("--table", help="DynamoDB movies table name")
    parser.add_argument("--queue-table", help="DynamoDB queue table name")
    parser.add_argument("--username", default="chad", help="Queue owner username (default: chad)")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    args = parser.parse_args()

    movies_table_name = args.table or get_table_name("dynamodb_table_name") or "movie-finder-dev-movies"
    queue_table_name = args.queue_table or get_table_name("queue_table_name") or "movie-finder-dev-queue"
    print(f"Seeding movies table: {movies_table_name}")
    print(f"Seeding queue table: {queue_table_name} (username: {args.username})")
    print(f"Region: {args.region}")

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    movies_table = dynamodb.Table(movies_table_name)
    queue_table = dynamodb.Table(queue_table_name)

    # Shuffle and assign random statuses
    random.seed(42)  # reproducible
    shuffled = list(MOVIES)
    random.shuffle(shuffled)

    # Assign statuses: ~40% active, ~35% recentlyWatched, ~25% notInterested
    status_assignments = []
    for movie in shuffled:
        r = random.random()
        if r < 0.40:
            status_assignments.append("active")
        elif r < 0.75:
            status_assignments.append("recentlyWatched")
        else:
            status_assignments.append("notInterested")

    # Group by status and assign ranks within each group
    groups = {s: [] for s in STATUSES}
    for movie, status in zip(shuffled, status_assignments):
        groups[status].append(movie)

    now_iso = datetime.now(timezone.utc).isoformat()
    written = 0

    # Write to both tables
    with movies_table.batch_writer() as movie_batch, queue_table.batch_writer() as queue_batch:
        for status, movie_list in groups.items():
            for i, (title, year, genre, rating, director) in enumerate(movie_list):
                movie_id = str(uuid.uuid4())
                rank = rank_for_index(i)

                # Movies table (shared catalog, no status/rank)
                movie_batch.put_item(Item={
                    "movie_id": movie_id,
                    "title": title,
                    "year": year,
                    "genre": genre,
                    "rating": Decimal(str(rating)),
                    "director": director,
                    "importedFrom": "bulkload",
                    "importedDate": now_iso,
                })

                # Queue table (per-user queue)
                sk = f"{status}#{rank}"
                queue_batch.put_item(Item={
                    "username": args.username,
                    "sk": sk,
                    "movie_id": movie_id,
                })

                written += 1

    for status in STATUSES:
        print(f"  {status}: {len(groups[status])} movies")
    print(f"Done! Wrote {written} movies to both tables.")


if __name__ == "__main__":
    main()
