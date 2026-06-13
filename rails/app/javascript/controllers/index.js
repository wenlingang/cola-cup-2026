// Explicit controller registry. esbuild bundles everything imported here —
// when adding a controller, import and register it below (the old importmap
// eagerLoadControllersFrom auto-discovery is gone).
import { application } from "./application"

import CountdownController from "./countdown_controller"
import EmojiPickerController from "./emoji_picker_controller"
import HelloController from "./hello_controller"
import HighlightMeController from "./highlight_me_controller"
import PreviewSheetController from "./preview_sheet_controller"
import QtyStepperController from "./qty_stepper_controller"
import ScheduleFilterController from "./schedule_filter_controller"
import ScoreFormController from "./score_form_controller"
import SettleSelectController from "./settle_select_controller"
import VotePanelController from "./vote_panel_controller"

application.register("countdown", CountdownController)
application.register("emoji-picker", EmojiPickerController)
application.register("hello", HelloController)
application.register("highlight-me", HighlightMeController)
application.register("preview-sheet", PreviewSheetController)
application.register("qty-stepper", QtyStepperController)
application.register("schedule-filter", ScheduleFilterController)
application.register("score-form", ScoreFormController)
application.register("settle-select", SettleSelectController)
application.register("vote-panel", VotePanelController)
