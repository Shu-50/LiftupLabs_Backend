@echo off
echo Installing Liftuplabs Backend...
echo.

echo Installing Node.js dependencies...
npm install

echo.
echo Setting up environment variables...
if not exist .env (
    copy .env.example .env
    echo Created .env file from .env.example
    echo Please edit .env file with your configuration
) else (
    echo .env file already exists
)

echo.
echo Installation completed!
echo.
echo Next steps:
echo 1. Make sure MongoDB is running
echo 2. Edit .env file with your configuration
echo 3. Run 'npm run setup' to initialize database with sample data
echo 4. Run 'npm run dev' to start the development server
echo.
pause