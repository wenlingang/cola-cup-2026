# Mission Control — Jobs: the Solid Queue dashboard, mounted at /admin/jobs
# (see config/routes.rb).
#
# The engine's ApplicationController fixes its superclass at class-load time
# (`class ApplicationController < base_controller_class.constantize`), so this
# must be set BEFORE that controller is autoloaded/eager-loaded — at initializer
# top level, not in a to_prepare block (which can run after the controller is
# already loaded under test). Admin::JobsBaseController applies the same
# settlers-only gate as the rest of the admin (rendering the rejection without a
# layout), so we also disable the engine's own HTTP Basic auth to avoid a second
# prompt.
MissionControl::Jobs.base_controller_class = "Admin::JobsBaseController"
MissionControl::Jobs.http_basic_auth_enabled = false
