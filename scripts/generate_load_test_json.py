import json
import random
import datetime
from pathlib import Path

random.seed(42)

commanders = [
    ("Atraxa, Praetors' Voice", "{1}{G}{W}{U}{B}"),
    ("The Ur-Dragon", "{4}{W}{U}{B}{R}{G}"),
    ("Korvold, Fae-Cursed King", "{2}{B}{R}{G}"),
    ("Kinnan, Bonder Prodigy", "{G}{U}"),
    ("Niv-Mizzet, Parun", "{U}{U}{U}{R}{R}{R}"),
    ("Muldrotha, the Gravetide", "{3}{B}{G}{U}"),
    ("Edgar Markov", "{3}{R}{W}{B}"),
    ("Yuriko, the Tiger's Shadow", "{1}{U}{B}"),
    ("Miirym, Sentinel Wyrm", "{3}{G}{U}{R}"),
    ("Winota, Joiner of Forces", "{2}{R}{W}"),
    ("Prosper, Tome-Bound", "{2}{B}{R}"),
]

fast_mana_pool = [
    "Sol Ring", "Mana Crypt", "Jeweled Lotus", "Arcane Signet", "Chrome Mox",
    "Mox Diamond", "Mana Vault", "Grim Monolith", "Lotus Petal", "Ancient Tomb",
]

win_conditions = [
    "Players Scooped", "Lethal Combat Damage", "Combat Trick", "Lethal Non-Combat Damage",
    "Players Decked Out", "Alternate Wincon", "Infinite Loop", "Infinite Life-Gain",
    "Infinite Mana", "Asymmetric Board Wipe",
]

key_cards = [
    "Thassa's Oracle", "Underworld Breach", "Dockside Extortionist", "Demonic Consultation",
    "Ad Nauseam", "Rhystic Study", "Smothering Tithe", "Cyclonic Rift", "Fierce Guardianship",
    "Esper Sentinel", "Deflecting Swat", "Jeska's Will",
]


def make_player(seat: int):
    name, mana = random.choice(commanders)
    color_identity = [c for c in ["W", "U", "B", "R", "G"] if c in mana]
    has_fast = random.random() < 0.65
    return {
        "commanderName": name,
        "commanderManaCost": mana,
        "commanderTypeLine": "Legendary Creature",
        "commanderColorIdentity": color_identity,
        "seatPosition": seat,
        "fastMana": {
            "hasFastMana": has_fast,
            "cards": random.sample(fast_mana_pool, random.randint(1, 4)) if has_fast else [],
        },
    }


def generate_games(count: int = 220):
    base_date = datetime.date(2025, 1, 1)
    games = []
    for i in range(count):
        player_count = random.randint(2, 6)
        players = [make_player(seat) for seat in range(1, player_count + 1)]
        random.shuffle(players)

        game = {
            "playedAt": (base_date + datetime.timedelta(days=i % 365)).isoformat(),
            "winTurn": random.randint(3, 14),
            "winnerIndex": random.randrange(player_count),
            "winConditions": random.sample(win_conditions, random.randint(1, 2)),
            "keyWinconCards": random.sample(key_cards, random.randint(1, 3)),
            "players": players,
        }

        note = random.choice([
            "Great game, close finish.",
            "Kept a risky hand and got there.",
            "Long grindy game with multiple wipes.",
            "Early interaction mattered a lot.",
            "",
        ])
        if note:
            game["notes"] = note

        games.append(game)
    return games


def main():
    payload = {
        "exportedAt": datetime.date.today().isoformat(),
        "games": generate_games(220),
    }

    output = Path("public/load-test-games.json")
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {output} with {len(payload['games'])} games")


if __name__ == "__main__":
    main()
