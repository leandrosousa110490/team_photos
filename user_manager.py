#!/usr/bin/env python3
"""
Terminal user manager with:
- login prompt (username + password)
- add new users (admin only)
- change your own password
- change other users' passwords (admin only)

Passwords are stored using PBKDF2-HMAC-SHA256 with a random salt.
"""

from __future__ import annotations

import getpass
import hmac
import hashlib
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

DB_FILE = "users.db"
PBKDF2_ITERATIONS = 200_000


@dataclass
class User:
    username: str
    is_admin: bool


def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            iterations INTEGER NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str, salt: bytes, iterations: int = PBKDF2_ITERATIONS) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def encode_hex(value: bytes) -> str:
    return value.hex()


def decode_hex(value: str) -> bytes:
    return bytes.fromhex(value)


def user_count(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT COUNT(*) FROM users").fetchone()
    return int(row[0]) if row else 0


def prompt_non_empty(prompt: str) -> str:
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("Value cannot be empty.")


def prompt_password_with_confirm() -> str:
    while True:
        pw1 = getpass.getpass("Password: ")
        pw2 = getpass.getpass("Confirm Password: ")
        if len(pw1) < 6:
            print("Password must be at least 6 characters.")
            continue
        if pw1 != pw2:
            print("Passwords do not match. Try again.")
            continue
        return pw1


def create_user(conn: sqlite3.Connection, username: str, password: str, is_admin: bool) -> None:
    salt = os.urandom(16)
    pw_hash = hash_password(password, salt)
    now = utc_now_iso()
    conn.execute(
        """
        INSERT INTO users (username, password_hash, salt, iterations, is_admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            username,
            encode_hex(pw_hash),
            encode_hex(salt),
            PBKDF2_ITERATIONS,
            1 if is_admin else 0,
            now,
            now,
        ),
    )
    conn.commit()


def update_password(conn: sqlite3.Connection, username: str, new_password: str) -> None:
    salt = os.urandom(16)
    pw_hash = hash_password(new_password, salt)
    conn.execute(
        """
        UPDATE users
        SET password_hash = ?, salt = ?, iterations = ?, updated_at = ?
        WHERE username = ?
        """,
        (
            encode_hex(pw_hash),
            encode_hex(salt),
            PBKDF2_ITERATIONS,
            utc_now_iso(),
            username,
        ),
    )
    conn.commit()


def get_user_row(conn: sqlite3.Connection, username: str) -> sqlite3.Row | None:
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return row


def verify_user_password(row: sqlite3.Row, candidate_password: str) -> bool:
    salt = decode_hex(row["salt"])
    expected = decode_hex(row["password_hash"])
    actual = hash_password(candidate_password, salt, int(row["iterations"]))
    return hmac.compare_digest(actual, expected)


def ensure_initial_admin(conn: sqlite3.Connection) -> None:
    if user_count(conn) > 0:
        return

    print("No users found. Create the first admin account.")
    username = prompt_non_empty("Admin Username: ")
    password = prompt_password_with_confirm()
    create_user(conn, username, password, is_admin=True)
    print(f"Admin user '{username}' created.\n")


def login(conn: sqlite3.Connection) -> User:
    while True:
        print("=== Login ===")
        username = prompt_non_empty("Username: ")
        password = getpass.getpass("Password: ")
        row = get_user_row(conn, username)
        if row and verify_user_password(row, password):
            print(f"Welcome, {username}.\n")
            return User(username=username, is_admin=bool(row["is_admin"]))
        print("Invalid username or password.\n")


def list_users(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "SELECT username, is_admin, created_at, updated_at FROM users ORDER BY username"
    ).fetchall()
    if not rows:
        print("No users found.")
        return
    print("\nUsers:")
    for row in rows:
        role = "admin" if row[1] else "user"
        print(f"- {row[0]} ({role}) | created: {row[2]} | updated: {row[3]}")
    print("")


def add_user_flow(conn: sqlite3.Connection, current: User) -> None:
    if not current.is_admin:
        print("Only admin users can add users.\n")
        return

    username = prompt_non_empty("New Username: ")
    if get_user_row(conn, username):
        print("That username already exists.\n")
        return
    password = prompt_password_with_confirm()
    admin_input = input("Make this user admin? (y/N): ").strip().lower()
    is_admin = admin_input == "y"
    create_user(conn, username, password, is_admin=is_admin)
    print(f"User '{username}' created.\n")


def change_own_password_flow(conn: sqlite3.Connection, current: User) -> None:
    row = get_user_row(conn, current.username)
    if not row:
        print("Your account no longer exists.\n")
        return

    current_pw = getpass.getpass("Current Password: ")
    if not verify_user_password(row, current_pw):
        print("Current password is incorrect.\n")
        return

    new_pw = prompt_password_with_confirm()
    update_password(conn, current.username, new_pw)
    print("Your password has been updated.\n")


def change_other_password_flow(conn: sqlite3.Connection, current: User) -> None:
    if not current.is_admin:
        print("Only admin users can change another user's password.\n")
        return

    target = prompt_non_empty("Username to update: ")
    row = get_user_row(conn, target)
    if not row:
        print("User not found.\n")
        return

    new_pw = prompt_password_with_confirm()
    update_password(conn, target, new_pw)
    print(f"Password updated for '{target}'.\n")


def print_menu(current: User) -> None:
    role = "admin" if current.is_admin else "user"
    print(f"=== User Manager ({current.username}, {role}) ===")
    print("1) Add user")
    print("2) Change my password")
    print("3) Change another user's password")
    print("4) List users")
    print("5) Log out")
    print("6) Exit")


def run() -> None:
    conn = connect_db()
    ensure_initial_admin(conn)

    active_user = login(conn)
    while True:
        print_menu(active_user)
        choice = input("Select an option: ").strip()
        print("")

        if choice == "1":
            add_user_flow(conn, active_user)
        elif choice == "2":
            change_own_password_flow(conn, active_user)
        elif choice == "3":
            change_other_password_flow(conn, active_user)
        elif choice == "4":
            list_users(conn)
        elif choice == "5":
            active_user = login(conn)
        elif choice == "6":
            print("Goodbye.")
            break
        else:
            print("Invalid option.\n")

    conn.close()


if __name__ == "__main__":
    run()
