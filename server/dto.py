from pydantic import BaseModel

class UserRegister(BaseModel):
    email: str
    password: str
    

class UserLogin(BaseModel):
    email: str
    password: str

class ContextCreate(BaseModel):
    user_input: str