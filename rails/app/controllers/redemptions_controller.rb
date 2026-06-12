class RedemptionsController < ApplicationController
  before_action :require_login!

  # Redeem credits for a drink. On success the personal page updates in place
  # (balance big number + redeem panel + redemption records); on failure (an
  # unknown drink or a non-positive quantity) the panel re-renders with the
  # Chinese error and a 422 so Turbo shows it without navigating. Balance is not
  # checked — redeeming is always allowed and the balance may go negative.
  def create
    Redemption.redeem!(user: current_user, drink_key: params[:drink].to_s, qty: redeem_qty)
    render_personal_state
  rescue Redemption::RedeemError => e
    @error = e.message
    render_personal_state(status: 422)
  end

  private

  def render_personal_state(status: :ok)
    @balance = current_user.net_balance
    @redemptions = current_user.redemptions.order(created_at: :desc, id: :desc)
    respond_to do |format|
      format.turbo_stream { render :create, status: status }
      format.html { redirect_to me_path, status: :see_other, alert: @error }
    end
  end

  # nil for anything that is not an integer string (e.g. "2.5", ""); the model
  # then rejects it with the "兑换数量需为正整数" message.
  def redeem_qty
    Integer(params[:qty], exception: false)
  end
end
