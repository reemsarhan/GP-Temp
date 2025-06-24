from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from controller.auth_controller import router as auth_router
from controller.match_controller import router as match_router

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["UserAPI"])
app.include_router(match_router, prefix="/analysis", tags=["MatchAPI"])