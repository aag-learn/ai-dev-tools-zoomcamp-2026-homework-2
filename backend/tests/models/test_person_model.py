from app.models import Person


def test_insert_persists_with_auto_assigned_id_and_name(db_session):
    person = Person(name="Alice")
    db_session.add(person)
    db_session.commit()

    fetched = db_session.get(Person, person.id)

    assert fetched is not None
    assert fetched.id is not None
    assert fetched.name == "Alice"


def test_duplicate_names_both_persist(db_session):
    db_session.add(Person(name="Bob"))
    db_session.add(Person(name="Bob"))
    db_session.commit()

    people = db_session.query(Person).filter_by(name="Bob").all()

    assert len(people) == 2
    assert {p.id for p in people} == {people[0].id, people[1].id}
    assert people[0].id != people[1].id
