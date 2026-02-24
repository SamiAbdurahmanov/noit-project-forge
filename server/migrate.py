"""
Database migration script - creates all tables
Run with: python migrate.py
"""
import asyncio
from database import engine, Base
from models import User, Context, ProgressSnapshot


async def create_tables():
    """Create all tables defined in models"""
    async with engine.begin() as conn:
        # Drop all tables (optional - remove if you want to keep existing data)
        # await conn.run_sync(Base.metadata.drop_all)
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ All tables created successfully!")
    print("   - users")
    print("   - contexts")
    print("   - progress_snapshots")


async def check_tables():
    """Verify tables exist"""
    async with engine.begin() as conn:
        result = await conn.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        tables = [row[0] for row in result]
        print("\n📋 Existing tables:", tables)


if __name__ == "__main__":
    print("🚀 Starting database migration...")
    asyncio.run(create_tables())
    asyncio.run(check_tables())
    print("\n✨ Migration complete!")