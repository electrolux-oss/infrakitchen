from fastapi import APIRouter
from .create_template_with_scv import api as create_template_with_scv
from .create_integration_with_storage import api as create_integration_with_storage

router = APIRouter(prefix="/use_cases")

router.include_router(
    create_template_with_scv.router,
    tags=["Cases"],
)

router.include_router(
    create_integration_with_storage.router,
    tags=["Cases"],
)
