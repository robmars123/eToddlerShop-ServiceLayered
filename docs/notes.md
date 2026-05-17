docker exec app-db-1 psql -U postgres -d appdb -c "\dt"

docker exec app-db-1 psql -U postgres -d appdb -c "SELECT * FROM users;"