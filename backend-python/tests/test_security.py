from passlib.hash import bcrypt


def test_password_hashing_and_verification():
    password = "EcoCusco2026!"
    hashed = bcrypt.hash(password)
    assert bcrypt.verify(password, hashed)
