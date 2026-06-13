module Admin
  # Base controller for the Mission Control — Jobs dashboard (mounted at
  # /admin/jobs). Same settler gate as the rest of the admin, but the engine
  # forces its own layout onto its controllers, and that layout needs job-server
  # data the gate halts before loading — so a rejected request must render the
  # locked page WITHOUT a layout, or the layout itself crashes.
  class JobsBaseController < BaseController
    private

    def require_admin_access!
      return if current_settler?

      render "admin/shared/locked", status: :forbidden, layout: false
    end
  end
end
