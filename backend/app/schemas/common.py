from pydantic import BaseModel, ConfigDict


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)
