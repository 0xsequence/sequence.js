import { v1v2 } from "./migrations"
import { Migrations } from "./migrator"

export const DefaultMigrations: Migrations = {
  2: v1v2
}
