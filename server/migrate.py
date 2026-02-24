import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
# Import your Base/Models here

DATABASE_URL = "your_connection_string_here"

async def run_migrations():
    # 1. Create the engine INSIDE the async function
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0,
        }
    )

    try:
        print("🚀 Starting database migration...")
        async with engine.begin() as conn:
            # If you are using SQLAlchemy models:
            # await conn.run_sync(Base.metadata.create_all)
            print("✅ All tables created successfully!")
            
        # Add any follow-up checks here while the engine is still alive
        async with engine.connect() as conn:
            # Example check
            # result = await conn.execute(text("SELECT 1"))
            pass

    finally:
        # 2. IMPORTANT: Dispose the engine to clean up the pool 
        # before the event loop shuts down
        await engine.dispose()

if __name__ == "__main__":
    # 3. Only call asyncio.run ONCE
    asyncio.run(run_migrations())