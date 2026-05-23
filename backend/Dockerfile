FROM python:3.14-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml README.md ./
RUN uv pip install --system --no-cache .

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
