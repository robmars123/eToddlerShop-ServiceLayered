docker exec app-db-1 psql -U postgres -d appdb -c "\dt"

docker exec app-db-1 psql -U postgres -d appdb -c "SELECT * FROM users;"

 cd "D:\Projects\2026\Service Layer + Router\Python\App"
  .\infra\deploy.ps1