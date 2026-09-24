#!/data/data/com.termux/files/usr/bin/bash

set -e

cd "$(dirname "$0")"

if [ ! -f "demo/c34_demo.db" ]; then
    echo "Demo database not found."
    echo "Run:"
    echo "python scripts/create_demo.py"
    exit 1
fi

export C34_DB_PATH="$PWD/demo/c34_demo.db"
export C34_SECRET_KEY="C34-DEMO-ONLY-CHANGE-ME"

echo
echo "======================================"
echo "      CANNIBAL 34 DEMO"
echo "======================================"
echo
echo "Database: $C34_DB_PATH"
echo "Demo login:"
echo "Badge:    C34-DEMO"
echo "Password: C34Demo123!"
echo
echo "Open: http://127.0.0.1:5001"
echo
echo "Press CTRL+C to stop."
echo

python backend/app.py
